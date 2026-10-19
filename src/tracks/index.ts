import type { TrackDef } from '../lib/types';
import { winton } from './winton';

const comingSoon = (id: string, name: string, venue: string, location: string): TrackDef => ({
  id,
  name,
  venue,
  location,
  lengthM: 0,
  startLine: [
    [0, 0],
    [0, 0],
  ],
  center: [0, 0],
  zoom: 15,
  corners: [],
  outline: [],
  available: false,
});

export const TRACKS: TrackDef[] = [
  winton,
  comingSoon('phillip-island', 'Phillip Island', 'Phillip Island Grand Prix Circuit', 'Phillip Island, VIC'),
  comingSoon('sandown', 'Sandown', 'Sandown Raceway', 'Springvale, VIC'),
  comingSoon('the-bend', 'The Bend GT', 'The Bend Motorsport Park', 'Tailem Bend, SA'),
];

export const trackById = (id: string) => TRACKS.find((t) => t.id === id);
