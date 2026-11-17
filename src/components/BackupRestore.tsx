import { useState, useRef } from 'react';
import { Download, Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/context/I18nContext';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import type { Apartment, Booking, GuestArchive, Location } from '@/types';

interface BackupData {
  version: number;
  exported_at: string;
  locations: Location[];
  apartments: Apartment[];
  bookings: Booking[];
  guests_archive: GuestArchive[];
}

export function BackupRestore() {
  const { t } = useI18n();
  const { triggerRefresh } = useApp();
  const { session } = useAuth();
  const [status, setStatus] = useState<'idle' | 'working' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userId = session?.user?.id;

  const handleExport = async () => {
    setStatus('working');
    setMessage(t('backup_exporting'));
    try {
      const [locRes, aptRes, bookRes, archRes] = await Promise.all([
        supabase.from('locations').select('*'),
        supabase.from('apartments').select('*'),
        supabase.from('bookings').select('*'),
        supabase.from('guests_archive').select('*'),
      ]);

      if (locRes.error || aptRes.error || bookRes.error || archRes.error) {
        throw new Error('fetch failed');
      }

      const backup: BackupData = {
        version: 1,
        exported_at: new Date().toISOString(),
        locations: locRes.data ?? [],
        apartments: aptRes.data ?? [],
        bookings: bookRes.data ?? [],
        guests_archive: archRes.data ?? [],
      };

      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatus('success');
      setMessage(t('backup_success'));
      setTimeout(() => setStatus('idle'), 3000);
    } catch {
      setStatus('error');
      setMessage(t('backup_error'));
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  const handleImport = async (file: File) => {
    setStatus('working');
    setMessage(t('backup_importing'));
    try {
      if (!userId) throw new Error('no authenticated user');

      const text = await file.text();
      const backup = JSON.parse(text) as BackupData;

      if (!backup.locations || !backup.apartments || !backup.bookings) {
        throw new Error('invalid backup file');
      }

      const uid = userId;

      // Strip ids so the database generates new ones, and set user_id to current user
      // This ensures imported data belongs to the current user and doesn't conflict
      const locations = backup.locations.map(({ id: _id, user_id: _uid, ...rest }) => ({
        ...rest,
        user_id: uid,
      }));

      // Build a map from old location IDs to new locations (by name match)
      const oldLocIdByName = new Map<string, string>();
      for (const loc of locations) {
        if (loc.name) oldLocIdByName.set(loc.name, loc.name);
      }

      // Insert locations first (by name to avoid duplicates)
      const insertedLocations = new Map<string, string>(); // oldId -> newId
      if (locations.length > 0) {
        // Check existing locations by name to avoid duplicates
        const { data: existingLocs } = await supabase.from('locations').select('id, name');
        const existingByName = new Map<string, string>();
        for (const el of existingLocs ?? []) existingByName.set(el.name, el.id);

        for (const loc of backup.locations) {
          if (existingByName.has(loc.name)) {
            insertedLocations.set(loc.id, existingByName.get(loc.name)!);
          } else {
            const { data, error } = await supabase.from('locations').insert({
              name: loc.name,
              display_order: loc.display_order,
              user_id: uid,
            }).select('id').single();
            if (error) throw error;
            insertedLocations.set(loc.id, data.id);
            existingByName.set(loc.name, data.id);
          }
        }
      }

      // Insert apartments (map old location_id to new, strip id)
      const insertedApartments = new Map<string, string>(); // oldId -> newId
      const apartmentsToInsert = backup.apartments.map(({ id: _id, user_id: _uid, location_id, ...rest }) => ({
        ...rest,
        location_id: location_id ? (insertedLocations.get(location_id) ?? null) : null,
        user_id: uid,
      }));

      if (apartmentsToInsert.length > 0) {
        // Check existing apartments by name to avoid duplicates
        const { data: existingApts } = await supabase.from('apartments').select('id, name');
        const existingByName = new Map<string, string>();
        for (const ea of existingApts ?? []) existingByName.set(ea.name, ea.id);

        for (let i = 0; i < apartmentsToInsert.length; i++) {
          const apt = apartmentsToInsert[i];
          const oldId = backup.apartments[i].id;
          if (existingByName.has(apt.name)) {
            insertedApartments.set(oldId, existingByName.get(apt.name)!);
          } else {
            const { data, error } = await supabase.from('apartments').insert(apt).select('id').single();
            if (error) throw error;
            insertedApartments.set(oldId, data.id);
            existingByName.set(apt.name, data.id);
          }
        }
      }

      // Insert bookings (map old apartment_id to new, strip id)
      const bookingsToInsert = backup.bookings.map(({ id: _id, user_id: _uid, apartment_id, ...rest }) => ({
        ...rest,
        apartment_id: apartment_id ? (insertedApartments.get(apartment_id) ?? null) : null,
        user_id: uid,
      })).filter((b) => b.apartment_id !== null);

      if (bookingsToInsert.length > 0) {
        const { error } = await supabase.from('bookings').insert(bookingsToInsert);
        if (error) throw error;
      }

      // Insert guests_archive (map old apartment_id to new, strip id)
      const archiveToInsert = (backup.guests_archive ?? []).map(({ id: _id, user_id: _uid, apartment_id, ...rest }) => ({
        ...rest,
        apartment_id: apartment_id ? (insertedApartments.get(apartment_id) ?? null) : null,
        user_id: uid,
      }));

      if (archiveToInsert.length > 0) {
        const { error } = await supabase.from('guests_archive').insert(archiveToInsert);
        if (error) throw error;
      }

      triggerRefresh();
      setStatus('success');
      setMessage(t('backup_success'));
      setTimeout(() => setStatus('idle'), 3000);
    } catch {
      setStatus('error');
      setMessage(t('backup_error'));
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (confirm(t('backup_confirm_restore'))) {
        handleImport(file);
      }
    }
    e.target.value = '';
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={handleExport}
        disabled={status === 'working'}
        className="btn-secondary"
      >
        {status === 'working' ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Download size={18} />
        )}
        {t('export_backup')}
      </button>

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={status === 'working'}
        className="btn-secondary"
      >
        <Upload size={18} />
        {t('import_backup')}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={onFileChange}
        className="hidden"
      />

      {status === 'success' && (
        <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 animate-fade-in">
          <CheckCircle2 size={16} />
          {message}
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-1.5 text-sm font-semibold text-red-500 animate-fade-in">
          <AlertCircle size={16} />
          {message}
        </div>
      )}
    </div>
  );
}
