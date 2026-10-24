import {NextResponse} from 'next/server';
import {providerAvailability} from '@/lib/oauth-providers';
export async function GET(){return NextResponse.json(await providerAvailability(),{headers:{'Cache-Control':'private, no-store'}});}
