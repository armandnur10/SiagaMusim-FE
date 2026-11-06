import { DISEASES, LEVELS } from '@/lib/config';
import { fmtDec, fmtInt, fmtRain } from '@/lib/format';
import type { Assessment, DiseaseId } from '@/types/ews';

interface MapTooltipProps {
  /** Nama kelurahan. */
  name: string;
  /** Nama kecamatan induk (tanpa awalan "Kec."). */
  kecamatan?: string;
  disease: DiseaseId;
  /** Penilaian minggu yang sedang ditampilkan; null bila wilayah tidak ada di dataset. */
  assessment: Assessment | null;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-2">{label}</dt>
      <dd className="num whitespace-nowrap font-semibold text-ink">{children}</dd>
    </div>
  );
}

/** Isi tooltip peta (internal untuk <RiskMap>): sama di semua mode besaran. */
export function MapTooltip({ name, kecamatan, disease, assessment }: MapTooltipProps) {
  const level = assessment ? LEVELS[assessment.level] : null;
  return (
    <div className="text-[12px] leading-[18px]">
      <p className="text-[13px] font-bold leading-[18px] text-ink">{name}</p>
      {kecamatan && <p className="text-[11px] leading-4 text-muted">Kec. {kecamatan}</p>}

      {assessment && level ? (
        <>
          <p
            className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-[2px] text-[11px] font-bold leading-4"
            style={{ backgroundColor: level.colorSoft, color: level.colorText }}
          >
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: level.color }} />
            {level.label}
          </p>
          <dl className="mt-2 flex flex-col gap-0.5">
            <Row label={`Kasus ${DISEASES[disease].short} minggu ini`}>{fmtInt(assessment.cases)}</Row>
            <Row label="Insidensi /100 rb">{fmtDec(assessment.incidenceRate, 1)}</Row>
            <Row label="Curah hujan">{fmtRain(assessment.rainThisWeek)}</Row>
            <Row label="Skor risiko">
              {fmtInt(assessment.score)}
              <span className="font-medium text-muted">/100</span>
            </Row>
          </dl>
        </>
      ) : (
        <p className="mt-1.5 text-[11px] text-muted">Data tidak tersedia untuk wilayah ini.</p>
      )}
    </div>
  );
}
