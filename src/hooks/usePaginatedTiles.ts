'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  orderBy,
  limit,
  startAfter,
  endBefore,
  limitToLast,
  onSnapshot,
  getDocs,
  doc,
  documentId,
  type DocumentSnapshot,
  type Query,
  type FirestoreError,
} from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { getFirebaseInstances } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/context/i18n';
import type { FirebaseTileDoc } from '@/types';

export const ITEMS_PER_PAGE_OPTIONS = [5, 10, 25, 50];

interface UsePaginatedTilesReturn {
  tiles: FirebaseTileDoc[];
  isLoading: boolean;
  error: string | null;
  itemsPerPage: number;
  currentPage: number;
  totalTileDocs: number;
  isFirstPage: boolean;
  isLastPage: boolean;
  handleItemsPerPageChange: (newItemsPerPage: number) => void;
  handlePageChange: (newPage: number, direction: 'next' | 'prev' | 'initial') => void;
  fetchTotalTileCount: () => Promise<void>;
  setTiles: Dispatch<SetStateAction<FirebaseTileDoc[]>>;
}

export const usePaginatedTiles = (): UsePaginatedTilesReturn => {
  const { user } = useAuth();
  const [tiles, setTiles] = useState<FirebaseTileDoc[]>([]);
  const [itemsPerPage, setItemsPerPage] = useState<number>(ITEMS_PER_PAGE_OPTIONS[1]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Cursors for pagination
  const [lastVisibleDoc, setLastVisibleDoc] = useState<DocumentSnapshot | null>(null);
  const [firstVisibleDoc, setFirstVisibleDoc] = useState<DocumentSnapshot | null>(null);
  const [pageCursors, setPageCursors] = useState<(DocumentSnapshot | null)[]>([null]); // Stores first doc of each page

  const [queryDirection, setQueryDirection] = useState<'initial' | 'next' | 'prev'>('initial');
  const [totalTileDocs, setTotalTileDocs] = useState<number>(0);

  const { toast } = useToast();
  const { t } = useTranslation();

  const fetchTotalTileCount = useCallback(async () => {
    if (!user) return;
    try {
      const { db } = await getFirebaseInstances();
      const tilesCollectionRef = collection(db, 'tiles');
      const snapshot = await getDocs(tilesCollectionRef);
      setTotalTileDocs(snapshot.size);
    } catch (err: any) {
      console.error("Error fetching total tile count:", err);
      // Do not toast here as it can be annoying; count is for UI display.
      // setError(t('errorMessages.fetchErrorDescription')); 
    }
  }, [user, t]);

  useEffect(() => {
    fetchTotalTileCount();
  }, [fetchTotalTileCount, user]);


  useEffect(() => {
    if (!user) {
      setTiles([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let unsubscribe: (() => void) | null = null;

    const setupFirestoreListener = async () => {
      try {
        const { db } = await getFirebaseInstances();
        const tilesCollectionRef = collection(db, 'tiles');
        let q: Query;

        const baseQuery = collection(db, 'tiles');
        const orderConstraints = [orderBy('createdAt', 'desc'), orderBy(documentId(), 'desc')];


        if (queryDirection === 'initial') {
          q = query(baseQuery, ...orderConstraints, limit(itemsPerPage));
          setPageCursors([null]); // Reset cursors for initial load
        } else if (queryDirection === 'next' && lastVisibleDoc) {
          q = query(baseQuery, ...orderConstraints, startAfter(lastVisibleDoc), limit(itemsPerPage));
        } else if (queryDirection === 'prev' && currentPage > 1 && pageCursors[currentPage -1]) {
           // For 'prev', we use endBefore with the first document of the current page's cursor (which is pageCursors[currentPage])
           // Or, if going to page 1, we don't need a cursor.
           // The cursor for start of page 'N' is stored at pageCursors[N-1]
           // The cursor for start of page 'currentPage' is pageCursors[currentPage-1]
           // So to go to 'currentPage-1', we need to endBefore pageCursors[currentPage-1]
           const cursorForEndOfPrevPage = pageCursors[currentPage-1]; // This is the first doc of current page
           if (cursorForEndOfPrevPage) {
             q = query(baseQuery, ...orderConstraints, endBefore(cursorForEndOfPrevPage), limitToLast(itemsPerPage));
           } else { // Should not happen if currentPage > 1 and pageCursors is managed well
             q = query(baseQuery, ...orderConstraints, limit(itemsPerPage)); // fallback to page 1
           }
        } else if (queryDirection === 'prev' && currentPage === 1) {
          q = query(baseQuery, ...orderConstraints, limit(itemsPerPage));
          setPageCursors([null]);
        }
         else { // Fallback or trying to go to page 1
          q = query(baseQuery, ...orderConstraints, limit(itemsPerPage));
          if (currentPage !== 1 && queryDirection !== 'initial') setCurrentPage(1); // Ensure current page is 1
          setPageCursors([null]);
        }

        unsubscribe = onSnapshot(q, (querySnapshot) => {
          const fetchedTiles: FirebaseTileDoc[] = [];
          querySnapshot.forEach((docSnap) => {
            fetchedTiles.push({ id: docSnap.id, ...docSnap.data() } as FirebaseTileDoc);
          });
          
          setTiles(fetchedTiles);

          if (!querySnapshot.empty) {
            const newFirstVisible = querySnapshot.docs[0];
            const newLastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
            setFirstVisibleDoc(newFirstVisible);
            setLastVisibleDoc(newLastVisible);

            if (queryDirection === 'next') {
                setPageCursors(prev => {
                    const newCursors = [...prev];
                    newCursors[currentPage] = newFirstVisible; // Store first doc of the NEW current page
                    return newCursors;
                });
            } else if (queryDirection === 'initial' || currentPage === 1) {
                setPageCursors([null, newFirstVisible]); // Page 1 starts with null, page 2 starts with newFirstVisible
            }
            // For 'prev', pageCursors are already set for previous pages. We are landing on currentPage-1.
            // The firstVisibleDoc of this page is now newFirstVisible.
            // The cursor for *this* page (which is now `currentPage`) should be `pageCursors[currentPage-1]`.

          } else {
            // Current page is empty
            if (queryDirection === 'next') {
              // Tried to go next, but no more items. current lastVisibleDoc is still valid for the actual last item.
              // No new lastVisibleDoc for an empty page.
            } else if (queryDirection === 'prev') {
              // Tried to go prev, but no items.
            }
             if (currentPage === 1 && (queryDirection === 'initial' || querySnapshot.empty)) {
                setFirstVisibleDoc(null);
                setLastVisibleDoc(null);
                setPageCursors([null]);
            }
          }
          setIsLoading(false);
          setError(null);
        }, (err: FirestoreError) => {
          console.error("Error fetching tiles:", err);
          setError(t('errorMessages.fetchErrorDescription'));
          toast({ title: t('errorMessages.fetchErrorTitle'), description: err.message, variant: "destructive" });
          setIsLoading(false);
        });

      } catch (err) {
        console.error("Firestore setup error:", err);
        setError(t('errorMessages.fetchErrorDescription'));
        toast({ title: t('errorMessages.fetchErrorTitle'), description: (err as Error).message, variant: "destructive" });
        setIsLoading(false);
      }
    };

    setupFirestoreListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user, currentPage, itemsPerPage, queryDirection, t, toast]); // Removed pageCursors from deps to avoid loops, manage it carefully

  const handlePageChange = useCallback((newPage: number, direction: 'next' | 'prev' | 'initial') => {
    // Prevent unnecessary state updates if already on the target page (unless it's an initial call)
    if (newPage === currentPage && direction !== 'initial' && queryDirection === direction) return;

    setQueryDirection(direction);
    setCurrentPage(newPage);
    setIsLoading(true); // Set loading true immediately for page change
  }, [currentPage, queryDirection]);

  const handleItemsPerPageChange = useCallback((newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page
    setQueryDirection('initial'); // Trigger initial fetch logic
    setLastVisibleDoc(null); // Reset cursors
    setFirstVisibleDoc(null);
    setPageCursors([null]); // Reset page cursors
    setIsLoading(true);
  }, []);
  
  const isFirstPage = currentPage === 1;
  const isLastPage = tiles.length < itemsPerPage || (totalTileDocs > 0 && (currentPage * itemsPerPage >= totalTileDocs));


  return {
    tiles,
    isLoading,
    error,
    itemsPerPage,
    currentPage,
    totalTileDocs,
    isFirstPage,
    isLastPage,
    handleItemsPerPageChange,
    handlePageChange,
    fetchTotalTileCount,
    setTiles
  };
};
