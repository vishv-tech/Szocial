"use client";
import {usePathname} from 'next/navigation';
import {useAppStore} from '@/components/AppStoreProvider';
import {pageDomains} from '@/lib/app-sync';
import {Button} from '@/components/Button';
export function ResourcePaging(){const path=usePathname(),{pages,loadMoreResource,error}=useAppStore();return <div className="mt-4 space-y-2">{error?<p role="status" className="text-sm text-szocial-muted">{error}</p>:null}{pageDomains(path).map(domain=>pages[domain]?.hasMore?<Button key={domain} variant="outline" onClick={()=>loadMoreResource(domain)}>Load more {domain}</Button>:null)}</div>;}
