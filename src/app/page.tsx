
"use client";

import type { FC } from 'react';
import { useState } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import { useTranslation } from '@/context/i18n';
import { Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';

const getLoginSchema = (t: (key: string) => string) => z.object({
  email: z.string().email({ message: t('errorMessages.emailInvalid') }).min(1, { message: t('errorMessages.emailRequired')}),
  password: z.string().min(6, { message: t('errorMessages.passwordMinLength') }),
});

const getRegisterSchema = (t: (key: string) => string) => z.object({
  email: z.string().email({ message: t('errorMessages.emailInvalid') }).min(1, { message: t('errorMessages.emailRequired')}),
  password: z.string().min(6, { message: t('errorMessages.passwordMinLength') }),
});

type LoginFormValues = z.infer<ReturnType<typeof getLoginSchema>>;
type RegisterFormValues = z.infer<ReturnType<typeof getRegisterSchema>>;

const AuthPage: FC = () => {
  const { login, register, currentUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("login");
  const [showPassword, setShowPassword] = useState(false);


  const loginSchema = getLoginSchema(t);
  const registerSchema = getRegisterSchema(t);

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "" },
  });

  if (currentUser) {
    router.push('/inventory');
    return null; 
  }

  const onLoginSubmit = async (data: LoginFormValues) => {
    try {
      await login(data.email, data.password);
      toast({ title: t('auth.loginTitle'), description: "Logged in successfully!" });
      router.push('/inventory');
    } catch (error: any) {
      console.error("Login failed:", error);
      toast({ title: t('auth.loginErrorTitle'), description: error.message || "Failed to login.", variant: "destructive" });
    }
  };

  const onRegisterSubmit = async (data: RegisterFormValues) => {
    try {
      await register(data.email, data.password);
      toast({ title: t('auth.registerTitle'), description: "Registered successfully! Please login." });
      setActiveTab("login"); // Switch to login tab after successful registration
      loginForm.reset(); // Reset login form as well, or just password
      registerForm.reset();
    } catch (error: any) {
      console.error("Registration failed:", error);
      toast({ title: t('auth.registerErrorTitle'), description: error.message || "Failed to register.", variant: "destructive" });
    }
  };
  
  const toggleShowPassword = () => setShowPassword(!showPassword);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
        <div className="absolute top-4 right-4 flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeSwitcher />
        </div>
      <Card className="w-full max-w-md shadow-2xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">{t('auth.loginTitle')}</TabsTrigger>
            <TabsTrigger value="register">{t('auth.registerTitle')}</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2"><LogIn className="h-6 w-6 text-primary" /> {t('auth.loginTitle')}</CardTitle>
              <CardDescription>{t('appDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-6">
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('auth.emailLabel')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('auth.emailPlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('auth.passwordLabel')}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input type={showPassword ? "text" : "password"} placeholder="••••••••" {...field} />
                            <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={toggleShowPassword}>
                              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                              <span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span>
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={loginForm.formState.isSubmitting}>
                    {loginForm.formState.isSubmitting ? "Logging in..." : t('auth.loginButton')}
                  </Button>
                </form>
              </Form>
            </CardContent>
            <CardFooter className="flex flex-col items-center">
              <p className="mt-4 text-sm text-muted-foreground">
                {t('auth.noAccount')}{' '}
                <Button variant="link" className="p-0 h-auto" onClick={() => setActiveTab("register")}>
                  {t('auth.signUpLink')}
                </Button>
              </p>
            </CardFooter>
          </TabsContent>
          <TabsContent value="register">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2"><UserPlus className="h-6 w-6 text-primary" />{t('auth.registerTitle')}</CardTitle>
              <CardDescription>{t('appDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...registerForm}>
                <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-6">
                  <FormField
                    control={registerForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('auth.emailLabel')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('auth.emailPlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('auth.passwordLabel')}</FormLabel>
                        <FormControl>
                           <div className="relative">
                            <Input type={showPassword ? "text" : "password"} placeholder="••••••••" {...field} />
                            <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={toggleShowPassword}>
                              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                               <span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span>
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={registerForm.formState.isSubmitting}>
                     {registerForm.formState.isSubmitting ? "Registering..." : t('auth.registerButton')}
                  </Button>
                </form>
              </Form>
            </CardContent>
            <CardFooter className="flex flex-col items-center">
               <p className="mt-4 text-sm text-muted-foreground">
                {t('auth.alreadyAccount')}{' '}
                <Button variant="link" className="p-0 h-auto" onClick={() => setActiveTab("login")}>
                  {t('auth.signInLink')}
                </Button>
              </p>
            </CardFooter>
          </TabsContent>
        </Tabs>
      </Card>
       <footer className="py-6 mt-auto text-center text-sm text-muted-foreground">
          <p>{t('footerCopyright', { year: new Date().getFullYear().toString() })}</p>
      </footer>
    </div>
  );
};

export default AuthPage;
