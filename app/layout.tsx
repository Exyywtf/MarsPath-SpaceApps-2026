import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import './atlas-experience.css';
import 'ol/ol.css';
export const metadata: Metadata={title:'MarsPath — Planetary atlas & mission planning',description:'Explore 13 Mars science destinations, plan terrain routes and compare numerical climate and modelled radiation profiles.'};
const sans=localFont({src:'./fonts/geist-sans.woff2',variable:'--font-sans',display:'swap',weight:'100 900'});
const mono=localFont({src:'./fonts/geist-mono.woff2',variable:'--font-mono',display:'swap',weight:'100 900'});
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" className={sans.variable+' '+mono.variable}><body>{children}</body></html>;}
