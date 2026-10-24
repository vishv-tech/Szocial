"use client";
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import type {SignupOutcome} from '@/lib/auth-flow';
export function useSignupSubmission(){
 const router=useRouter(),lock=useRef(false),[pending,setPending]=useState(false),[blocked,setBlocked]=useState(false),[message,setMessage]=useState(''),[until,setUntil]=useState(0),[seconds,setSeconds]=useState(0);
 useEffect(()=>{const tick=()=>setSeconds(Math.max(0,Math.ceil((until-Date.now())/1000)));tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer);},[until]);
 const submit=async(task:()=>Promise<SignupOutcome>)=>{
  if(lock.current||blocked||Date.now()<until)return;lock.current=true;setPending(true);setMessage('');
  let result:SignupOutcome;
  try{result=await task();}catch{result={outcome:'uncertain',message:'We could not confirm the result. Check your inbox or try signing in before submitting another signup.'};}
  if(result.outcome==='confirmation_required'||result.outcome==='authenticated'){
   setBlocked(true);router.replace(result.next);return;
  }
  setMessage('message' in result?result.message:'Please try signing in.');setPending(false);
  if(result.outcome==='uncertain'){setBlocked(true);return;}
  if(result.outcome==='rate_limited')setUntil(Date.now()+(result.retryAfter??120)*1000);
  lock.current=false;
 };
 return {submit,pending,message,disabled:pending||blocked||seconds>0,seconds};
}
