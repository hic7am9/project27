export type ApartmentStatus = 'occupied' | 'ready' | 'not_ready' | 'maintenance';

export type TeamRole = 'owner' | 'host' | 'cleaner';

export type BookingSource = 'airbnb' | 'gathern' | 'whatsapp' | 'direct';

export type PaymentMethod = 'cash' | 'bank_transfer' | 'visa' | 'mada';

export const AIRBNB_ACCOUNTS = ['hic7am.skills@gmail.com', 'hic7am1998@gmail.com'] as const;
export type AirbnbAccount = typeof AIRBNB_ACCOUNTS[number];

export interface Location {
  id: string;
  name: string;
  display_order: number;
  created_at: string;
  user_id: string;
}

export interface Apartment {
  id: string;
  location_id: string | null;
  name: string;
  apt_number: string | null;
  unit_type: string | null;
  building_number: string | null;
  floor_number: string | null;
  maps_url: string | null;
  airbnb_account: string | null;
  display_order: number;
  status: ApartmentStatus;
  maintenance_note: string | null;
  current_booking_id: string | null;
  ical_url: string | null;
  airbnb_listing_id: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  location?: Location | null;
  current_booking?: Booking | null;
}

export interface Booking {
  id: string;
  apartment_id: string;
  guest_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  source: BookingSource;
  check_in: string;
  check_out: string;
  total_price: number | null;
  balance: number;
  paid: boolean;
  payment_method: PaymentMethod | null;
  notes: string | null;
  archived: boolean;
  created_at: string;
  external_uid: string | null;
  sync_source: string | null;
  attachment_url: string | null;
  user_id: string;
  apartment?: Apartment | null;
}

export interface GuestArchive {
  id: string;
  apartment_id: string | null;
  apartment_name: string | null;
  apartment_number: string | null;
  location_name: string | null;
  guest_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  source: string | null;
  check_in: string | null;
  check_out: string | null;
  total_price: number | null;
  balance: number | null;
  paid: boolean | null;
  payment_method: string | null;
  notes: string | null;
  rating: number | null;
  archived_at: string;
  user_id: string;
}

export interface Cleaner {
  id: string;
  username: string;
  display_name: string | null;
  created_at: string;
  user_id: string;
}

export interface CleanerAssignment {
  id: string;
  cleaner_id: string;
  apartment_id: string;
  created_at: string;
  user_id: string;
}

export interface TeamMember {
  id: string;
  owner_id: string;
  member_user_id: string | null;
  role: TeamRole;
  email: string;
  created_at: string;
}

export type InviteStatus = 'pending' | 'used' | 'expired';

export interface TeamInvite {
  id: string;
  owner_id: string;
  email: string;
  role: TeamRole;
  token: string;
  status: InviteStatus;
  expires_at: string;
  created_at: string;
  used_at: string | null;
}

export interface CleaningLog {
  id: string;
  apartment_id: string;
  cleaner_user_id: string;
  owner_id: string;
  cleaned_at: string;
  apartment?: Apartment | null;
  cleaner?: { email: string } | null;
}

export interface CleanerApartmentView {
  apartment_id: string;
  apartment_name: string;
  apt_number: string | null;
  location_name: string | null;
  status: ApartmentStatus;
  next_check_out: string | null;
}
