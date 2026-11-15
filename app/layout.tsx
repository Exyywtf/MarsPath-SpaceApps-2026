import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import './atlas-experience.css';
import './documents.css';
import './controls.css';
import './mission.css';
import 'ol/ol.css';
import { DocumentScrollbars } from '@/components/ScrollArea';
export const metadata: Metadata={title:'MarsPath — Planetary atlas & mission planning',description:'Explore sourced imagery of Mars, plan terrain routes and compare geologic, climate and radiation evidence.'};
export const viewport: Viewport = { viewportFit: "cover", themeColor: "#090e12" };
const sans=localFont({src:'./fonts/geist-sans.woff2',variable:'--font-sans',display:'swap',weight:'100 900'});
const mono=localFont({src:'./fonts/geist-mono.woff2',variable:'--font-mono',display:'swap',weight:'100 900'});
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" className={sans.variable+' '+mono.variable}><body>{children}<DocumentScrollbars /></body></html>;}
