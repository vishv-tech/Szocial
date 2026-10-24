import {Suspense} from 'react';
import {AuthFailure} from '@/components/AuthFailure';
export default function AuthError(){return <Suspense fallback={<p>Loading…</p>}><AuthFailure/></Suspense>;}
