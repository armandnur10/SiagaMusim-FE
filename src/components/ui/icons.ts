import { Bug, CloudRain, Eye, GlassWater, ShieldCheck, Siren, TriangleAlert, Wind, type LucideIcon } from 'lucide-react';
import type { AlertLevel, DiseaseId } from '@/types/ews';

/** Ikon level peringatan — selalu dipakai bersama label teks (status tidak pernah warna saja). */
export const LEVEL_ICONS: Record<AlertLevel, LucideIcon> = {
  normal: ShieldCheck,
  waspada: Eye,
  siaga: TriangleAlert,
  awas: Siren,
};

export const DISEASE_ICONS: Record<DiseaseId, LucideIcon> = {
  dbd: Bug,
  muntaber: GlassWater,
  influenza: Wind,
};

export const RainIcon = CloudRain;
