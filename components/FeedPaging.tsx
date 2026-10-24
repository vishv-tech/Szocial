import {Button} from '@/components/Button';
export function FeedPaging({loading,refreshing,error,hasMore,loadMore,retry}:{loading:boolean;refreshing?:boolean;error:string;hasMore:boolean;loadMore:()=>void;retry?:()=>void}){
 return <div aria-live="polite">{error?<p role="status" className="rounded-xl p-3 text-sm text-szocial-muted">{error} {retry?<button type="button" className="underline" onClick={retry}>Retry</button>:null}</p>:null}{loading?<p className="p-4 text-sm text-szocial-muted">Loading posts…</p>:hasMore?<Button disabled={refreshing} onClick={loadMore} variant="outline">Load more posts</Button>:null}</div>;
}
