import {NextResponse} from 'next/server';
import {pendingSignup} from '@/lib/auth-pending';
import {maskedEmail} from '@/lib/auth-flow';
export async function GET(){const pending=await pendingSignup();return NextResponse.json(pending?.accepted?{pending:true,email:maskedEmail(pending.email),business:pending.business,retryAfter:Math.max(0,Math.ceil((pending.retryAt-Date.now())/1000))}:{pending:false},{headers:{'Cache-Control':'private, no-store'}});}
