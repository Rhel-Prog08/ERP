import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { toApiError } from '../../services/apiClient';
import { companiesService } from '../../services/companiesService';
import { settingsService } from '../../services/settingsService';
import type { Company, Settings } from '../../types/models';
import { formatDateTime } from '../../utils/format';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { ErrorState, LoadingState } from '../../components/ui/States';

interface CompanyForm {
  name: string;
  legalName: string;
  taxId: string;
  phone: string;
  email: string;
  address: string;
}

function toCompanyForm(company: Company): CompanyForm {
  return {
    name: company.name,
    legalName: company.legalName ?? '',
    taxId: company.taxId ?? '',
    phone: company.phone ?? '',
    email: company.email ?? '',
    address: company.address ?? '',
  };
}

/** Configuración: datos de la empresa y ajustes fiscales/stock reales. */
export default function ConfiguracionScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const toast = useToast();
  const { can } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [company, setCompany] = useState<Company | null>(null);
  const [companyForm, setCompanyForm] = useState<CompanyForm | null>(null);
  const [companyErrors, setCompanyErrors] = useState<Record<string, string | undefined>>({});
  const [savingCompany, setSavingCompany] = useState(false);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [taxRateText, setTaxRateText] = useState('');
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);
  const [settingsErrors, setSettingsErrors] = useState<Record<string, string | undefined>>({});
  const [savingSettings, setSavingSettings] = useState(false);

  const loadAll = useCallback((): Promise<void> => {
    return Promise.all([companiesService.get(), settingsService.get()])
      .then(([companyDoc, settingsDoc]) => {
        setCompany(companyDoc);
        setCompanyForm(toCompanyForm(companyDoc));
        setSettings(settingsDoc);
        setTaxRateText(String(settingsDoc.taxRate));
        setAllowNegativeStock(settingsDoc.allowNegativeStock);
      })
      .catch((err) => setError(toApiError(err).message))
      .finally(() => setLoading(false));
  }, []);

  /** Recarga manual (evento de UI: sí puede marcar loading/error antes). */
  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const canEditCompany = can('companies.update');
  const canEditSettings = can('settings.update');

  const saveCompany = async () => {
    if (!company || !companyForm) return;
    setCompanyErrors({});
    if (!companyForm.name.trim()) {
      setCompanyErrors({ name: 'El nombre es obligatorio' });
      return;
    }
    setSavingCompany(true);
    try {
      const payload = {
        name: companyForm.name.trim(),
        legalName: companyForm.legalName.trim() || undefined,
        taxId: companyForm.taxId.trim() || undefined,
        phone: companyForm.phone.trim() || undefined,
        email: companyForm.email.trim() || undefined,
        address: companyForm.address.trim() || undefined,
      };
      const updated = await companiesService.updateOwn(company._id, payload);
      setCompany(updated);
      setCompanyForm(toCompanyForm(updated));
      toast.success('Datos de la empresa actualizados');
    } catch (err) {
      const apiError = toApiError(err);
      setCompanyErrors({
        name: apiError.fieldError('name'),
        legalName: apiError.fieldError('legalName'),
        taxId: apiError.fieldError('taxId'),
        phone: apiError.fieldError('phone'),
        email: apiError.fieldError('email'),
        address: apiError.fieldError('address'),
      });
      if (!apiError.details?.length) toast.error(apiError.message);
    } finally {
      setSavingCompany(false);
    }
  };

  const saveSettings = async () => {
    setSettingsErrors({});
    const rate = Number(taxRateText.trim().replace(',', '.'));
    if (!taxRateText.trim() || Number.isNaN(rate) || rate < 0 || rate > 1) {
      setSettingsErrors({ taxRate: 'Introduce un valor entre 0 y 1 (0.21 = 21 %)' });
      return;
    }
    setSavingSettings(true);
    try {
      const updated = await settingsService.update({
        taxRate: rate,
        allowNegativeStock,
      });
      setSettings(updated);
      setTaxRateText(String(updated.taxRate));
      setAllowNegativeStock(updated.allowNegativeStock);
      toast.success('Ajustes actualizados');
    } catch (err) {
      const apiError = toApiError(err);
      setSettingsErrors({
        taxRate: apiError.fieldError('taxRate'),
        allowNegativeStock: apiError.fieldError('allowNegativeStock'),
      });
      if (!apiError.details?.length) toast.error(apiError.message);
    } finally {
      setSavingSettings(false);
    }
  };

  if (!can('settings.read')) {
    return (
      <ScrollView contentContainerStyle={styles.wrap}>
        <ScreenHeader title="Configuración" subtitle="Empresa y ajustes" />
        <Card>
          <Text style={[styles.noPermission, { color: c.textMuted }]}>
            No tienes permiso para ver la configuración. Contacta con tu administrador si necesitas acceso.
          </Text>
        </Card>
      </ScrollView>
    );
  }

  if (loading && !company && !settings) return <LoadingState message="Cargando configuración…" />;
  if (error && !company && !settings) return <ErrorState message={error} onRetry={load} />;

  const readOnly = !canEditCompany;

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <ScreenHeader
        title="Configuración"
        subtitle="Datos de la empresa y ajustes fiscales"
        actions={<Button title="Recargar" variant="secondary" size="sm" onPress={load} loading={loading} />}
      />

      {/* Empresa */}
      <Card title="Empresa">
        {!company || !companyForm ? (
          <Text style={{ color: c.textMuted, fontSize: 14 }}>No se han podido cargar los datos de la empresa.</Text>
        ) : (
          <View style={styles.form}>
            <Input
              label="Nombre *"
              value={companyForm.name}
              onChangeText={(v) => setCompanyForm((f) => (f ? { ...f, name: v } : f))}
              error={companyErrors.name}
              placeholder="Nombre comercial"
              editable={canEditCompany && !savingCompany}
              containerStyle={readOnly ? styles.readonly : undefined}
            />
            <Input
              label="Razón social"
              value={companyForm.legalName}
              onChangeText={(v) => setCompanyForm((f) => (f ? { ...f, legalName: v } : f))}
              error={companyErrors.legalName}
              placeholder="Razón social completa"
              editable={canEditCompany && !savingCompany}
              containerStyle={readOnly ? styles.readonly : undefined}
            />
            <View style={styles.formRow}>
              <Input
                label="NIF / CIF"
                value={companyForm.taxId}
                onChangeText={(v) => setCompanyForm((f) => (f ? { ...f, taxId: v } : f))}
                error={companyErrors.taxId}
                placeholder="B00000000"
                editable={canEditCompany && !savingCompany}
                containerStyle={[styles.formCol, readOnly ? styles.readonly : undefined]}
              />
              <Input
                label="Teléfono"
                value={companyForm.phone}
                onChangeText={(v) => setCompanyForm((f) => (f ? { ...f, phone: v } : f))}
                error={companyErrors.phone}
                keyboardType="phone-pad"
                placeholder="600 000 000"
                editable={canEditCompany && !savingCompany}
                containerStyle={[styles.formCol, readOnly ? styles.readonly : undefined]}
              />
            </View>
            <Input
              label="Email"
              value={companyForm.email}
              onChangeText={(v) => setCompanyForm((f) => (f ? { ...f, email: v } : f))}
              error={companyErrors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="contacto@empresa.com"
              editable={canEditCompany && !savingCompany}
              containerStyle={readOnly ? styles.readonly : undefined}
            />
            <Input
              label="Dirección"
              value={companyForm.address}
              onChangeText={(v) => setCompanyForm((f) => (f ? { ...f, address: v } : f))}
              error={companyErrors.address}
              placeholder="Dirección fiscal"
              editable={canEditCompany && !savingCompany}
              containerStyle={readOnly ? styles.readonly : undefined}
            />
            {canEditCompany ? (
              <View style={styles.formActions}>
                <Button title="Guardar empresa" onPress={() => void saveCompany()} loading={savingCompany} />
              </View>
            ) : (
              <Text style={[styles.readonlyHint, { color: c.textMuted }]}>
                Necesitas el permiso «companies.update» para editar los datos de la empresa.
              </Text>
            )}
          </View>
        )}
      </Card>

      {/* Ajustes fiscales y stock */}
      <Card title="Ajustes fiscales y stock" style={styles.section}>
        {!settings ? (
          <Text style={{ color: c.textMuted, fontSize: 14 }}>No se han podido cargar los ajustes.</Text>
        ) : (
          <View style={styles.form}>
            <Input
              label="Tipo impositivo (taxRate)"
              value={taxRateText}
              onChangeText={setTaxRateText}
              error={settingsErrors.taxRate}
              hint="0.21 = 21 %"
              keyboardType="decimal-pad"
              editable={canEditSettings && !savingSettings}
              containerStyle={!canEditSettings ? styles.readonly : undefined}
            />

            <View style={styles.toggleRow}>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: allowNegativeStock, disabled: !canEditSettings || savingSettings }}
                disabled={!canEditSettings || savingSettings}
                onPress={() => setAllowNegativeStock((v) => !v)}
                style={[
                  styles.switchTrack,
                  {
                    backgroundColor: allowNegativeStock ? c.primary : c.border,
                    opacity: canEditSettings && !savingSettings ? 1 : 0.6,
                  },
                ]}
              >
                <View
                  style={[
                    styles.switchThumb,
                    {
                      backgroundColor: c.card,
                      alignSelf: allowNegativeStock ? 'flex-end' : 'flex-start',
                    },
                  ]}
                />
              </Pressable>
              <View style={styles.toggleTexts}>
                <Text style={[styles.toggleLabel, { color: c.text }]}>Permitir stock negativo</Text>
                <Text style={[styles.toggleHint, { color: c.textMuted }]}>
                  Si está activo, las salidas pueden dejar el stock por debajo de cero.
                </Text>
              </View>
            </View>
            {settingsErrors.allowNegativeStock ? (
              <Text style={[styles.error, { color: c.danger }]}>{settingsErrors.allowNegativeStock}</Text>
            ) : null}

            <Text style={[styles.updatedAt, { color: c.textMuted }]}>
              Última actualización: {formatDateTime(settings.updatedAt)}
            </Text>

            {canEditSettings ? (
              <View style={styles.formActions}>
                <Button title="Guardar ajustes" onPress={() => void saveSettings()} loading={savingSettings} />
              </View>
            ) : (
              <Text style={[styles.readonlyHint, { color: c.textMuted }]}>
                Necesitas el permiso «settings.update» para modificar los ajustes.
              </Text>
            )}
          </View>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 40 },
  form: { gap: 14 },
  formRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  formCol: { flexGrow: 1, minWidth: 180 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  section: { marginTop: 16 },
  readonly: { opacity: 0.65 },
  readonlyHint: { fontSize: 12 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchTrack: { width: 46, height: 26, borderRadius: 13, padding: 3, justifyContent: 'center' },
  switchThumb: { width: 20, height: 20, borderRadius: 10 },
  toggleTexts: { flex: 1 },
  toggleLabel: { fontSize: 14, fontWeight: '600' },
  toggleHint: { fontSize: 12 },
  error: { fontSize: 12, fontWeight: '500' },
  updatedAt: { fontSize: 12 },
  noPermission: { fontSize: 14, textAlign: 'center', paddingVertical: 8 },
});
