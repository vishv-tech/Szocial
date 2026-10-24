import {Button} from '@/components/Button';
export function FeedPaging({loading,error,hasMore,loadMore}:{loading:boolean;error:string;hasMore:boolean;loadMore:()=>void}){
 return <div aria-live="polite">{error?<p role="alert" className="rounded-2xl bg-red-50 p-4 text-red-700">{error}</p>:null}{loading?<p className="p-4 text-sm text-szocial-muted">Loading posts…</p>:hasMore?<Button onClick={loadMore} variant="outline">Load more posts</Button>:null}</div>;
}
