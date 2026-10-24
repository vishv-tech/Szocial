import type {LocationInfo} from '@/types';
import {sortByNearbyRelevance} from '@/lib/nearby-ranking';
export type BusinessCandidate={id:string;name:string;category:string;about?:string;location?:LocationInfo;created_at:string};
/** Filter and rank the complete authorized candidate set before taking a page. */
export function businessCatalog(rows:BusinessCandidate[],location:LocationInfo,query='',category='All'){
 const search=query.trim().toLocaleLowerCase();
 const matches=rows.filter(b=>(category==='All'||b.category===category)&&(!search||`${b.name} ${b.about??''} ${b.category}`.toLocaleLowerCase().includes(search)));
 matches.sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)||a.id.localeCompare(b.id));
 return sortByNearbyRelevance(matches,location,b=>b.location);
}
