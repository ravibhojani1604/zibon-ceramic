
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
  query, // Keep this import
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
      // Apply query only if user.uid is available, else it's a global query
      const q = user.uid ? query(tilesCollectionRef, orderBy('userId'), orderBy('createdAt', 'desc')) : query(tilesCollectionRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
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
        let firestoreQuery: Query; // Renamed from q to firestoreQuery

        const baseQuery = collection(db, 'tiles');
        // Add a userId filter if user.uid is present
        const userSpecificConstraints = user.uid ? [orderBy('userId'), orderBy('createdAt', 'desc')] : [orderBy('createdAt', 'desc')];
        const orderConstraints = user.uid 
            ? [orderBy('userId'), orderBy('createdAt', 'desc'), orderBy(documentId(), 'desc')] 
            : [orderBy('createdAt', 'desc'), orderBy(documentId(), 'desc')];


        if (queryDirection === 'initial') {
          firestoreQuery = query(baseQuery, ...orderConstraints, limit(itemsPerPage));
          setPageCursors([null]); // Reset cursors for initial load
        } else if (queryDirection === 'next' && lastVisibleDoc) {
          firestoreQuery = query(baseQuery, ...orderConstraints, startAfter(lastVisibleDoc), limit(itemsPerPage));
        } else if (queryDirection === 'prev' && currentPage > 1 && pageCursors[currentPage -1]) {
           const cursorForEndOfPrevPage = pageCursors[currentPage-1]; 
           if (cursorForEndOfPrevPage) {
             firestoreQuery = query(baseQuery, ...orderConstraints, endBefore(cursorForEndOfPrevPage), limitToLast(itemsPerPage));
           } else { 
             firestoreQuery = query(baseQuery, ...orderConstraints, limit(itemsPerPage)); 
           }
        } else if (queryDirection === 'prev' && currentPage === 1) {
          firestoreQuery = query(baseQuery, ...orderConstraints, limit(itemsPerPage));
          setPageCursors([null]);
        }
         else { 
          firestoreQuery = query(baseQuery, ...orderConstraints, limit(itemsPerPage));
          if (currentPage !== 1 && queryDirection !== 'initial') setCurrentPage(1); 
          setPageCursors([null]);
        }

        unsubscribe = onSnapshot(firestoreQuery, (querySnapshot) => { // Use firestoreQuery here
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
                    newCursors[currentPage] = newFirstVisible; 
                    return newCursors;
                });
            } else if (queryDirection === 'initial' || currentPage === 1) {
                setPageCursors([null, newFirstVisible]); 
            }
          } else {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, currentPage, itemsPerPage, queryDirection, t, toast]); // pageCursors removed from deps

  const handlePageChange = useCallback((newPage: number, direction: 'next' | 'prev' | 'initial') => {
    if (newPage === currentPage && direction !== 'initial' && queryDirection === direction) return;

    setQueryDirection(direction);
    setCurrentPage(newPage);
    setIsLoading(true); 
  }, [currentPage, queryDirection]);

  const handleItemsPerPageChange = useCallback((newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); 
    setQueryDirection('initial'); 
    setLastVisibleDoc(null); 
    setFirstVisibleDoc(null);
    setPageCursors([null]); 
    setIsLoading(true);
  }, []);
  
  const isFirstPage = currentPage === 1;
  // Determine isLastPage more accurately:
  // It's the last page if fewer items than itemsPerPage are loaded,
  // OR if the total count is known and current items reach or exceed it.
  const isLastPage = (tiles.length > 0 && tiles.length < itemsPerPage) || (totalTileDocs > 0 && (currentPage * itemsPerPage >= totalTileDocs));


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

