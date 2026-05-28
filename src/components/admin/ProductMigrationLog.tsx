import React, { useEffect, useState } from 'react';
import {
  History,
  RotateCcw,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  PackageCheck,
  PackagePlus,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import {
  listMigrationLogs,
  rollbackMigration,
  detectRollbackConflicts,
  deleteMigrationLog,
  type MigrationLogDoc,
  type RollbackConflict,
} from '../../services/productMigrationService';

interface Props {
  /** Rollback uğurlu olduqdan sonra ana məhsul siyahısının yenidən yüklənməsi üçün */
  onChanged?: () => void;
}

const fmtDate = (ts: any): string => {
  if (!ts) return '—';
  try {
    const d =
      typeof ts.toDate === 'function'
        ? ts.toDate()
        : ts instanceof Date
        ? ts
        : new Date(ts);
    return d.toLocaleString('az-AZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

/**
 * ProductMigrationLog — Miqrasiya jurnalı və geri qaytarma paneli.
 *
 * Hər miqrasiyanın detalı + "Geri qaytar" düyməsi göstərilir. Geri qaytarmadan
 * əvvəl sistem konfliktləri yoxlayır (sonradan kimsə həmin malı redaktə edibsə)
 * və istifadəçidən təsdiq alır.
 */
const ProductMigrationLog: React.FC<Props> = ({ onChanged }) => {
  const [logs, setLogs] = useState<MigrationLogDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Rollback modal state
  const [rollbackTarget, setRollbackTarget] = useState<MigrationLogDoc | null>(null);
  const [conflicts, setConflicts] = useState<RollbackConflict[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [rolling, setRolling] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await listMigrationLogs();
      setLogs(data);
    } catch (e) {
      console.warn('Miqrasiya jurnalı yüklənə bilmədi:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const openRollback = async (log: MigrationLogDoc) => {
    setRollbackTarget(log);
    setConflicts(null);
    setChecking(true);
    try {
      const c = await detectRollbackConflicts(log);
      setConflicts(c);
    } catch (e) {
      alert('Konflikt yoxlanışı alınmadı: ' + (e as Error).message);
      setRollbackTarget(null);
    } finally {
      setChecking(false);
    }
  };

  const confirmRollback = async (force: boolean) => {
    if (!rollbackTarget) return;
    setRolling(true);
    try {
      const appliedBy =
        (typeof window !== 'undefined' && localStorage.getItem('adminEmail')) ||
        (typeof window !== 'undefined' && localStorage.getItem('userEmail')) ||
        'admin';
      const res = await rollbackMigration(rollbackTarget, appliedBy, force);
      const parts: string[] = [];
      if (res.updatedCount > 0) parts.push(`${res.updatedCount} məhsulun köhnə dəyəri bərpa olundu`);
      if (res.deletedCount > 0) parts.push(`${res.deletedCount} yaradılmış məhsul silindi`);
      if (res.skippedCount > 0) parts.push(`${res.skippedCount} mal atlandı (sonradan redaktə edilib və ya yoxdur)`);
      alert(parts.join('\n') || 'Heç bir dəyişiklik edilmədi');
      setRollbackTarget(null);
      setConflicts(null);
      onChanged?.();
      await refresh();
    } catch (e) {
      alert('Geri qaytarma xətası: ' + (e as Error).message);
    } finally {
      setRolling(false);
    }
  };

  const handleDelete = async (log: MigrationLogDoc) => {
    if (!confirm(`Bu jurnal yazısını tamamilə silmək istəyirsiniz?\n\nQeyd: bu yalnız jurnaldan silər — bazadakı dəyişiklikləri geri qaytarmaq üçün əvvəlcə "Geri qaytar" düyməsindən istifadə edin.`)) return;
    try {
      await deleteMigrationLog(log.id);
      await refresh();
    } catch (e) {
      alert('Silmək alınmadı: ' + (e as Error).message);
    }
  };

  return (
    <div className="border border-dashed border-gray-300 rounded-xl p-5 bg-gradient-to-br from-indigo-50/40 to-white" data-testid="product-migration-log">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-start gap-3">
          <History className="h-6 w-6 text-indigo-700 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-gray-900">Miqrasiya jurnalı</h3>
            <p className="text-xs text-gray-600 mt-0.5 max-w-2xl">
              Son tətbiq olunan Excel miqrasiyalarının siyahısı. Səhv olubsa,
              uyğun yazıdan <strong>&quot;Geri qaytar&quot;</strong> düyməsi ilə bazanı əvvəlki
              vəziyyətə qaytara bilərsiniz. Sistem konfliktləri (sonradan redaktə
              olunmuş malları) avtomatik aşkar edir və təsdiq istəyir.
            </p>
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60"
          data-testid="migration-log-refresh"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
          Yenilə
        </button>
      </div>

      {loading && logs.length === 0 && (
        <div className="text-sm text-gray-500 flex items-center gap-2 py-6 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Yüklənir...
        </div>
      )}

      {!loading && logs.length === 0 && (
        <div className="text-sm text-gray-500 py-6 text-center bg-white rounded-lg border border-gray-100">
          Hələ heç bir miqrasiya tətbiq olunmayıb.
        </div>
      )}

      <div className="space-y-2">
        {logs.map((log) => {
          const isExpanded = expandedId === log.id;
          const isRolledBack = log.status === 'rolled_back';
          return (
            <div
              key={log.id}
              className={`border rounded-lg bg-white transition-colors ${
                isRolledBack ? 'border-gray-200 opacity-70' : 'border-indigo-200'
              }`}
              data-testid={`migration-log-${log.id}`}
            >
              <div className="px-3 py-2.5 flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900"
                  data-testid={`migration-log-toggle-${log.id}`}
                  aria-label="Detallar"
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <FileSpreadsheet className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <div className="flex-1 min-w-[200px]">
                  <div className="text-sm font-medium text-gray-900 truncate" title={log.fileName}>
                    {log.fileName}
                  </div>
                  <div className="text-[11px] text-gray-500 flex items-center gap-2 flex-wrap">
                    <span>{fmtDate(log.appliedAt)}</span>
                    <span>·</span>
                    <span title={log.appliedBy}>{log.appliedBy}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  {log.summary.updatedCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200">
                      <PackageCheck className="h-3 w-3" />
                      {log.summary.updatedCount} yeniləndi
                    </span>
                  )}
                  {log.summary.createdCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                      <PackagePlus className="h-3 w-3" />
                      {log.summary.createdCount} yeni
                    </span>
                  )}
                  {log.summary.skippedCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200">
                      {log.summary.skippedCount} atlandı
                    </span>
                  )}
                </div>
                {isRolledBack ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-gray-100 text-gray-600 rounded border border-gray-200">
                    <RotateCcw className="h-3 w-3" />
                    Geri qaytarıldı
                  </span>
                ) : (
                  <button
                    onClick={() => openRollback(log)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] bg-white border border-indigo-300 text-indigo-700 rounded hover:bg-indigo-50 font-medium"
                    data-testid={`migration-log-rollback-${log.id}`}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Geri qaytar
                  </button>
                )}
                <button
                  onClick={() => handleDelete(log)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  title="Jurnal yazısını sil"
                  data-testid={`migration-log-delete-${log.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-gray-100 text-xs space-y-3" data-testid={`migration-log-detail-${log.id}`}>
                  {isRolledBack && log.rolledBackAt && (
                    <div className="bg-gray-50 border border-gray-200 rounded p-2 text-gray-600">
                      Geri qaytarılıb: {fmtDate(log.rolledBackAt)} · {log.rolledBackBy || '—'}
                    </div>
                  )}

                  {log.updates.length > 0 && (
                    <div>
                      <p className="font-medium text-gray-800 mb-1 flex items-center gap-1">
                        <PackageCheck className="h-3.5 w-3.5 text-emerald-600" />
                        Yenilənmiş mallar ({log.updates.length})
                      </p>
                      <div className="max-h-40 overflow-y-auto rounded border border-gray-100 divide-y divide-gray-100">
                        {log.updates.map((u, i) => (
                          <div key={i} className="px-2.5 py-1.5 flex items-center gap-3 bg-white">
                            <span className="flex-1 truncate text-gray-700">{u.productName}</span>
                            <span className="text-[11px] font-mono text-gray-500">
                              {Object.keys(u.newValues).map((k) => (
                                <span key={k} className="mr-2">
                                  {k}: <span className="text-red-600">{JSON.stringify(u.oldValues[k])}</span> →{' '}
                                  <span className="text-emerald-700">{JSON.stringify(u.newValues[k])}</span>
                                </span>
                              ))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {log.creations.length > 0 && (
                    <div>
                      <p className="font-medium text-gray-800 mb-1 flex items-center gap-1">
                        <PackagePlus className="h-3.5 w-3.5 text-blue-600" />
                        Yaradılmış mallar ({log.creations.length})
                      </p>
                      <div className="max-h-40 overflow-y-auto rounded border border-gray-100 divide-y divide-gray-100">
                        {log.creations.map((c, i) => (
                          <div key={i} className="px-2.5 py-1.5 bg-white text-gray-700 truncate">
                            {c.productName}{' '}
                            <span className="text-[10px] text-gray-400 font-mono">#{c.productId}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Rollback confirmation modal */}
      {rollbackTarget && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50"
          onClick={() => !rolling && setRollbackTarget(null)}
          data-testid="rollback-confirm-modal"
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-indigo-600" />
                <h3 className="font-semibold text-gray-900">Miqrasiyanı geri qaytar</h3>
              </div>
              <button
                onClick={() => !rolling && setRollbackTarget(null)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded"
                disabled={rolling}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div className="bg-gray-50 rounded p-3 text-xs text-gray-700">
                <div><strong>Fayl:</strong> {rollbackTarget.fileName}</div>
                <div><strong>Tarix:</strong> {fmtDate(rollbackTarget.appliedAt)}</div>
                <div><strong>Etdi:</strong> {rollbackTarget.appliedBy}</div>
                <div>
                  <strong>Tətbiqi:</strong> {rollbackTarget.summary.updatedCount} yenilənmiş ·{' '}
                  {rollbackTarget.summary.createdCount} yaradılmış
                </div>
              </div>

              {checking && (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Konfliktlər yoxlanılır...
                </div>
              )}

              {!checking && conflicts !== null && conflicts.length === 0 && (
                <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded p-3 text-emerald-800">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Konflikt yoxdur — təhlükəsiz geri qaytarma.</p>
                    <p className="text-xs mt-0.5">
                      Bütün dəyişdirilən mallar miqrasiyadan sonra başqa redaktə görməyib.
                      &quot;Davam et&quot;-ə basaraq bazanı əvvəlki vəziyyətə qaytara bilərsiniz.
                    </p>
                  </div>
                </div>
              )}

              {!checking && conflicts !== null && conflicts.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded p-3 text-amber-900">
                    <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Diqqət — {conflicts.length} konflikt aşkar olundu.</p>
                      <p className="text-xs mt-0.5">
                        Bu mallar miqrasiyadan sonra başqa redaktə görüb (admin paneldən
                        dəyişdirilib). Geri qaytarsanız, həmin sonrakı dəyişikliklər
                        <strong> itəcək</strong>. Aşağıdakı siyahıdan baxa bilərsiniz.
                      </p>
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto border border-amber-100 rounded">
                    {conflicts.map((c, i) => (
                      <div key={i} className="px-3 py-1.5 text-xs border-b border-amber-50 last:border-b-0 bg-white">
                        <div className="font-medium text-gray-800">{c.productName}</div>
                        <div className="text-gray-600 font-mono text-[11px]">
                          {c.field}: indi <span className="text-amber-700">{JSON.stringify(c.actualCurrent)}</span>
                          {' · '}miqrasiyada qoyulmuşdu <span className="text-gray-500">{JSON.stringify(c.expectedCurrent)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setRollbackTarget(null)}
                disabled={rolling}
                className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded disabled:opacity-60"
                data-testid="rollback-cancel"
              >
                Ləğv et
              </button>
              {!checking && conflicts !== null && conflicts.length === 0 && (
                <button
                  onClick={() => confirmRollback(false)}
                  disabled={rolling}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium disabled:opacity-60"
                  data-testid="rollback-confirm-safe"
                >
                  {rolling && <Loader2 className="h-4 w-4 animate-spin" />}
                  Davam et və geri qaytar
                </button>
              )}
              {!checking && conflicts !== null && conflicts.length > 0 && (
                <>
                  <button
                    onClick={() => confirmRollback(false)}
                    disabled={rolling}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded font-medium disabled:opacity-60"
                    data-testid="rollback-confirm-skip-conflicts"
                    title="Konfliktli mallar toxunmadan qalsın"
                  >
                    Konfliktsiz olanları geri qaytar
                  </button>
                  <button
                    onClick={() => confirmRollback(true)}
                    disabled={rolling}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded font-medium disabled:opacity-60"
                    data-testid="rollback-confirm-force"
                    title="Konfliktli mallar da köhnə vəziyyətə qaytarılacaq (sonrakı redaktələr itəcək)"
                  >
                    {rolling && <Loader2 className="h-4 w-4 animate-spin" />}
                    Konfliktə baxmayaraq qaytar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductMigrationLog;
