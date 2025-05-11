
'use client';

import type { FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CardContent, CardFooter } from '@/components/ui/card';
import { useTranslation } from '@/context/i18n';
import Link from 'next/link'; // Import Link

const getAuthSchema = (t: (key: string) => string, isRegister: boolean) => {
  const schema = z.object({
    email: z.string().email({ message: t('authForm.emailInvalidError') }),
    password: z.string().min(6, { message: t('authForm.passwordMinLengthError') }),
  });
  if (isRegister) {
    return schema.extend({
      confirmPassword: z.string().min(6, { message: t('authForm.confirmPasswordMinLengthError') }),
    }).refine(data => data.password === data.confirmPassword, {
      message: t('authForm.passwordsDoNotMatchError'),
      path: ['confirmPassword'],
    });
  }
  return schema;
};

export type AuthFormData = z.infer<ReturnType<typeof getAuthSchema>>;

interface AuthFormProps {
  isRegister: boolean;
  onSubmit: (data: AuthFormData) => Promise<void>;
  loading: boolean;
}

const AuthForm: FC<AuthFormProps> = ({ isRegister, onSubmit, loading }) => {
  const { t } = useTranslation();
  const authSchema = getAuthSchema(t, isRegister);

  const { register, handleSubmit, formState: { errors } } = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">{t('authForm.emailLabel')}</Label>
          <Input id="email" type="email" {...register('email')} placeholder={t('authForm.emailPlaceholder')} />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t('authForm.passwordLabel')}</Label>
          <Input id="password" type="password" {...register('password')} placeholder="••••••••" />
          {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
        </div>
        {isRegister && (
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('authForm.confirmPasswordLabel')}</Label>
            <Input id="confirmPassword" type="password" {...register('confirmPassword')} placeholder="••••••••" />
            {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col space-y-3">
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? t('authForm.loadingButton') : (isRegister ? t('authForm.registerButton') : t('authForm.loginButton'))}
        </Button>
        {isRegister ? (
          <p className="text-sm text-center text-muted-foreground">
            {t('authForm.alreadyHaveAccount')}{' '}
            <Link href="/login" className="underline text-primary hover:text-primary/80">
              {t('authForm.loginLink')}
            </Link>
          </p>
        ) : (
          <p className="text-sm text-center text-muted-foreground">
            {t('authForm.dontHaveAccount')}{' '}
            <Link href="/register" className="underline text-primary hover:text-primary/80">
              {t('authForm.registerLink')}
            </Link>
          </p>
        )}
      </CardFooter>
    </form>
  );
};

export default AuthForm;
