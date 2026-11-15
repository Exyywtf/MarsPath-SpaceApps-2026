import Atlas from '@/components/Atlas';
import PageTransition from '@/components/PageTransition';
import { pageMetadata } from '@/lib/site';
export const metadata = pageMetadata('/', 'MarsPath — Plan science traverses on Mars',
  'Explore orbital imagery, plan terrain-aware routes and compare science objectives in an interactive Mars atlas.');
export default function Home(){return <PageTransition page="atlas"><Atlas/></PageTransition>;}
