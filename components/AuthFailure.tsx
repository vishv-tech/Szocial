"use client";
import {useSearchParams} from 'next/navigation';
import {AuthLayout} from '@/components/AuthLayout';
import {Button} from '@/components/Button';
export function AuthFailure(){const q=useSearchParams(),business=q.get('intent')==='business';return <AuthLayout title="Sign-in couldn't finish" subtitle="Your account has not been changed."><div className="space-y-4"><p>{q.get('reason')==='cancelled'?'Sign-in was cancelled. You can try again or use email.':q.get('reason')==='recovery'?'This recovery link is invalid or expired. Request a new password reset link.':'The verification link may have expired, or social sign-in could not complete. Return to login or request a new verification email from the Check Email page.'}</p><Button href={business?'/business/login':'/login'}>Return to login</Button><Button href="/check-email" variant="outline">Check email instructions</Button><Button href="/forgot-password" variant="ghost">Reset password</Button></div></AuthLayout>;}
