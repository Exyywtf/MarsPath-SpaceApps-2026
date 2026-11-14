import type { Metadata } from 'next';
import './globals.css';
import 'ol/ol.css';
export const metadata: Metadata={title:'MarsPath — Planetary atlas & mission planning',description:'Explore authentic Mars orbital imagery, 13 scientific destinations, and transparent terrain-based regional route planning.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
