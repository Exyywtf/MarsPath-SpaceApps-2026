import SourceLibrary from '@/components/SourceLibrary';
import PageTransition from '@/components/PageTransition';
import { pageMetadata } from '@/lib/site';
export const metadata = pageMetadata('/sources/', 'Sources — MarsPath',
  'Explore the original Mars imagery, terrain, climate and science records behind MarsPath, with processing details and usage terms.');
export default function Sources(){return <PageTransition page="sources"><SourceLibrary/></PageTransition>;}
