"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useId,
  useMemo,
  useCallback,
} from "react";
import { PublicAvailableSlotDto } from "@barberkece/contracts";
import {
  AlertCircleIcon,
  XIcon,
  ClockIcon,
  CalendarIcon,
} from "@/components/ui/icons";
import { formatDateIndonesian, formatTimeWib } from "@/lib/format";

export interface RescheduleAppointmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string;
  bookingReference: string;
  serviceId: string;
  serviceName: string;
  barberProfileId: string;
  barberName: string;
  currentStartsAt: string; // ISO string
  currentEndsAt: string; // ISO string
  serviceDurationMinutes: number;
  triggerRef?: React.RefObject<HTMLElement | null>;
  onSuccess?: () => void;
  onStaleStatus?: () => void;
  fetchFn?: typeof fetch;
}

/**
 * Validates eligibility for appointment rescheduling.
 * Backend remains authoritative.
 */
export function isRescheduleEligible(
  status: string,
  barberProfileId?: string | null,
): boolean {
  return status === "CONFIRMED" && Boolean(barberProfileId);
}

/**
 * Compares two datetime values as equivalent UTC instants,
 * completely immune to string formatting differences (e.g. .000Z vs Z).
 */
export function isSameInstant(
  a: string | Date | null | undefined,
  b: string | Date | null | undefined,
): boolean {
  if (!a || !b) return false;
  try {
    const timeA = typeof a === "string" ? new Date(a).getTime() : a.getTime();
    const timeB = typeof b === "string" ? new Date(b).getTime() : b.getTime();
    return !isNaN(timeA) && !isNaN(timeB) && timeA === timeB;
  } catch {
    return false;
  }
}

/**
 * Returns today's date in Asia/Jakarta timezone as YYYY-MM-DD.
 */
export function getJakartaTodayString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Derives the YYYY-MM-DD calendar date in Asia/Jakarta timezone for a given instant.
 */
export function toJakartaDateString(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(d.getTime())) {
    return getJakartaTodayString();
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Adds days to a YYYY-MM-DD date using pure calendar date arithmetic in UTC,
 * preventing any browser-local timezone offset or DST distortions.
 */
export function addJakartaDays(
  baseJakartaDateStr: string,
  daysToAdd: number,
): string {
  const [year, month, day] = baseJakartaDateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + daysToAdd));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * Maps HTTP error responses from reschedule mutation into safe, human-readable Indonesian messages.
 * Never exposes raw backend, SQL, or database error traces.
 */
export function mapRescheduleErrorMessage(
  status: number,
  errorData?: { code?: string; message?: string },
): { message: string; isStaleSlot?: boolean; isStaleStatus?: boolean } {
  if (status === 401 || status === 403) {
    return {
      message:
        "Sesi Anda telah berakhir atau Anda tidak memiliki izin. Silakan masuk kembali.",
    };
  }

  if (status === 404) {
    return {
      message:
        "Janji temu tidak ditemukan atau Anda tidak memiliki akses ke data ini.",
    };
  }

  if (status === 400) {
    const msg = (errorData?.message ?? "").toLowerCase();

    // Cutoff exceeded: generic copy without hardcoding hours
    if (msg.includes("cutoff")) {
      return {
        message:
          "Batas waktu perubahan jadwal mandiri telah terlewati. Silakan hubungi barbershop jika memerlukan bantuan.",
      };
    }

    // Appointment status changed away from CONFIRMED
    if (msg.includes("transition") || msg.includes("status")) {
      return {
        message:
          "Status janji temu telah berubah dan tidak dapat diubah jadwalnya lagi.",
        isStaleStatus: true,
      };
    }

    // Genuine stale slot / conflict: conservative matching
    if (
      msg.includes("already booked") ||
      msg.includes("slotalreadybooked") ||
      msg.includes("active appointment") ||
      msg.includes("conflict") ||
      msg.includes("customerbookingconflict") ||
      msg.includes("overlap") ||
      msg.includes("schedule exception") ||
      msg.includes("not working") ||
      msg.includes("barbernotworking")
    ) {
      return {
        message:
          "Waktu yang dipilih sudah tidak tersedia lagi karena baru saja dipesan. Silakan pilih waktu lain.",
        isStaleSlot: true,
      };
    }

    // Outside business hours or horizon
    if (
      msg.includes("business hours") ||
      msg.includes("outside hours") ||
      msg.includes("outsidebusinesshours") ||
      msg.includes("horizon") ||
      msg.includes("in the future") ||
      msg.includes("invalid booking date")
    ) {
      return {
        message:
          "Waktu yang dipilih berada di luar jam operasional atau batas periode reservasi.",
      };
    }

    return {
      message:
        "Permintaan perubahan jadwal tidak dapat diproses. Silakan periksa kembali jadwal Anda.",
    };
  }

  return {
    message:
      "Terjadi kesalahan pada sistem saat memperbarui jadwal. Silakan coba beberapa saat lagi.",
  };
}

/**
 * Fetches available slots for a specific barber on a specific date.
 * Guarantees barberProfileId is passed and never requests Any Barber.
 */
export async function fetchAvailableSlots(
  serviceId: string,
  barberProfileId: string,
  date: string,
  options?: {
    signal?: AbortSignal;
    fetchFn?: typeof fetch;
  },
): Promise<
  | { success: true; slots: PublicAvailableSlotDto[] }
  | { success: false; errorMessage: string }
> {
  if (!barberProfileId) {
    return {
      success: false,
      errorMessage: "Barber tidak valid untuk perubahan jadwal.",
    };
  }

  const fetchImpl = options?.fetchFn ?? fetch;
  const params = new URLSearchParams({
    serviceId,
    date,
    barberProfileId,
  });

  try {
    const res = await fetchImpl(
      `/api/v1/appointments/available-slots?${params.toString()}`,
      {
        method: "GET",
        signal: options?.signal,
      },
    );

    if (!res.ok) {
      return {
        success: false,
        errorMessage:
          "Gagal memuat jadwal tersedia. Silakan coba beberapa saat lagi.",
      };
    }

    const json = await res.json();
    return {
      success: true,
      slots: json.data ?? [],
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw err;
    }
    return {
      success: false,
      errorMessage: "Gagal terhubung ke server saat memuat slot waktu.",
    };
  }
}

/**
 * Executes the reschedule HTTP POST mutation.
 */
export async function executeRescheduleRequest(
  appointmentId: string,
  newStartsAt: string,
  fetchFn: typeof fetch = fetch,
): Promise<
  | { success: true }
  | {
      success: false;
      errorMessage: string;
      isStaleSlot?: boolean;
      isStaleStatus?: boolean;
    }
> {
  try {
    const res = await fetchFn(
      `/api/v1/appointments/${appointmentId}/reschedule`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ newStartsAt }),
      },
    );

    if (res.ok) {
      return { success: true };
    }

    let errorData: { code?: string; message?: string } | undefined;
    try {
      const json = await res.json();
      errorData = json?.error;
    } catch {
      // Ignore JSON parse errors
    }

    const mapped = mapRescheduleErrorMessage(res.status, errorData);
    return {
      success: false,
      errorMessage: mapped.message,
      isStaleSlot: mapped.isStaleSlot,
      isStaleStatus: mapped.isStaleStatus,
    };
  } catch {
    return {
      success: false,
      errorMessage:
        "Gagal terhubung ke server. Silakan periksa koneksi internet Anda atau coba beberapa saat lagi.",
    };
  }
}

export function RescheduleAppointmentDialog({
  isOpen,
  onClose,
  appointmentId,
  bookingReference,
  serviceId,
  serviceName,
  barberProfileId,
  barberName,
  currentStartsAt,
  currentEndsAt,
  serviceDurationMinutes,
  triggerRef,
  onSuccess,
  onStaleStatus,
  fetchFn = fetch,
}: RescheduleAppointmentDialogProps) {
  const dialogId = useId();
  const titleId = `${dialogId}-title`;
  const descId = `${dialogId}-desc`;

  const dialogRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef<number>(0);

  // Derive initial selected date from current appointment startsAt in Jakarta
  const initialDate = useMemo(() => {
    return toJakartaDateString(currentStartsAt);
  }, [currentStartsAt]);

  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [slots, setSlots] = useState<PublicAvailableSlotDto[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(true);
  const [slotFetchError, setSlotFetchError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] =
    useState<PublicAvailableSlotDto | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Generate selectable dates for quick selection (next 14 days from Jakarta today)
  const selectableDates = useMemo(() => {
    const todayJakarta = getJakartaTodayString();
    const list: {
      dateStr: string;
      dayName: string;
      dayNumber: number;
      monthName: string;
      isToday: boolean;
    }[] = [];

    for (let i = 0; i < 14; i++) {
      const dateStr = addJakartaDays(todayJakarta, i);
      const [y, m, d] = dateStr.split("-").map(Number);
      const dObj = new Date(Date.UTC(y, m - 1, d));

      const dayName = new Intl.DateTimeFormat("id-ID", {
        weekday: "short",
        timeZone: "UTC",
      }).format(dObj);
      const monthName = new Intl.DateTimeFormat("id-ID", {
        month: "short",
        timeZone: "UTC",
      }).format(dObj);

      list.push({
        dateStr,
        dayName,
        dayNumber: d,
        monthName,
        isToday: i === 0,
      });
    }

    return list;
  }, []);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setSelectedDate(initialDate);
    setSelectedSlot(null);
    setMutationError(null);
    setSlotFetchError(null);
    onClose();
    // Return focus to trigger button
    triggerRef?.current?.focus();
  }, [isSubmitting, initialDate, onClose, triggerRef]);

  const [refetchTrigger, setRefetchTrigger] = useState(0);

  // Fetch slots whenever dialog is open, selectedDate changes, or refetchTrigger updates
  useEffect(() => {
    if (!isOpen || !barberProfileId) return;

    let isCancelled = false;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const currentRequestId = ++activeRequestIdRef.current;

    fetchAvailableSlots(serviceId, barberProfileId, selectedDate, {
      signal: abortController.signal,
      fetchFn,
    })
      .then((res) => {
        if (isCancelled || currentRequestId !== activeRequestIdRef.current)
          return;
        if (res.success) {
          setSlots(res.slots);
          setSlotFetchError(null);
          // If currently selected slot is not in the new response, clear it
          setSelectedSlot((prev) => {
            if (
              prev &&
              !res.slots.some((s) => isSameInstant(s.startsAt, prev.startsAt))
            ) {
              return null;
            }
            return prev;
          });
        } else {
          setSlotFetchError(res.errorMessage);
          setSlots([]);
        }
        setIsLoadingSlots(false);
      })
      .catch((err: unknown) => {
        if (isCancelled || (err instanceof Error && err.name === "AbortError"))
          return;
        if (currentRequestId === activeRequestIdRef.current) {
          setSlotFetchError(
            "Gagal memuat jadwal tersedia. Silakan coba beberapa saat lagi.",
          );
          setSlots([]);
          setIsLoadingSlots(false);
        }
      });

    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, [
    isOpen,
    barberProfileId,
    serviceId,
    selectedDate,
    refetchTrigger,
    fetchFn,
  ]);

  // Keyboard Escape listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, handleClose]);

  // Focus trap inside modal
  useEffect(() => {
    if (!isOpen) return;

    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener("keydown", handleFocusTrap);
    dialogRef.current?.focus();

    return () => window.removeEventListener("keydown", handleFocusTrap);
  }, [isOpen]);

  if (!isOpen) return null;

  // Check if selected slot matches current appointment start instant
  const isSameTimeSlot = Boolean(
    selectedSlot && isSameInstant(selectedSlot.startsAt, currentStartsAt),
  );

  const canSubmit = Boolean(
    selectedSlot && !isSameTimeSlot && !isSubmitting && !isLoadingSlots,
  );

  const handleSelectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    setMutationError(null);
  };

  const handleRetryFetchSlots = () => {
    setIsLoadingSlots(true);
    setSlotFetchError(null);
    setRefetchTrigger((c) => c + 1);
  };

  const handleSubmit = async () => {
    if (
      !canSubmit ||
      !selectedSlot ||
      isSameInstant(selectedSlot.startsAt, currentStartsAt)
    ) {
      return;
    }

    setIsSubmitting(true);
    setMutationError(null);

    const result = await executeRescheduleRequest(
      appointmentId,
      selectedSlot.startsAt,
      fetchFn,
    );

    setIsSubmitting(false);

    if (result.success) {
      onSuccess?.();
      handleClose();
    } else {
      setMutationError(result.errorMessage);

      if (result.isStaleSlot) {
        setSelectedSlot(null);
        setIsLoadingSlots(true);
        setRefetchTrigger((c) => c + 1);
      } else if (result.isStaleStatus) {
        onStaleStatus?.();
      }
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === backdropRef.current && !isSubmitting) {
      handleClose();
    }
  };

  const currentDateFormatted = formatDateIndonesian(
    toJakartaDateString(currentStartsAt),
  );
  const currentTimeFormatted = `${formatTimeWib(currentStartsAt)} - ${formatTimeWib(currentEndsAt)} WIB`;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      data-testid="reschedule-dialog-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#11110F]/70 backdrop-blur-xs overflow-y-auto animate-fade-in"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        data-testid="reschedule-appointment-dialog"
        className="w-full max-w-lg bg-[#FAF8F3] border border-[#D8D4CA] rounded-2xl shadow-xl overflow-hidden my-8 focus:outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-[#D8D4CA] bg-[#FAF8F3]">
          <div>
            <h2
              id={titleId}
              className="text-lg sm:text-xl font-extrabold uppercase tracking-tight text-[#11110F]"
            >
              Ubah Jadwal Janji Temu
            </h2>
            <p id={descId} className="text-xs text-[#6E6C65] mt-0.5">
              Kode Reservasi:{" "}
              <span className="font-bold text-[#11110F]">
                {bookingReference}
              </span>
            </p>
          </div>
          <button
            type="button"
            data-testid="close-reschedule-dialog-button"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Tutup dialog perubahan jadwal"
            className="p-1.5 text-[#6E6C65] hover:text-[#11110F] rounded-lg hover:bg-[#D8D4CA]/30 transition-colors disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[#C9F23B] cursor-pointer"
          >
            <XIcon size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Mutation Error Alert */}
          {mutationError && (
            <div
              role="alert"
              data-testid="reschedule-error-alert"
              className="p-3.5 bg-[#B63D37]/10 border border-[#B63D37]/30 rounded-xl flex items-start gap-2.5 text-xs text-[#B63D37] font-medium"
            >
              <AlertCircleIcon size={16} className="shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Gagal Mengubah Jadwal</p>
                <p>{mutationError}</p>
              </div>
            </div>
          )}

          {/* Schedule Comparison Box */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-[#F3F0E8] border border-[#D8D4CA] rounded-xl text-xs">
            {/* Old Schedule */}
            <div className="space-y-1 border-b sm:border-b-0 sm:border-r border-[#D8D4CA] pb-2 sm:pb-0 sm:pr-3">
              <span className="font-bold uppercase text-[10px] tracking-wider text-[#6E6C65]">
                Jadwal Saat Ini
              </span>
              <p className="font-bold text-[#11110F]">{currentDateFormatted}</p>
              <p className="text-[#6E6C65]">{currentTimeFormatted}</p>
              <p className="text-[11px] text-[#6E6C65] pt-0.5">
                Barber:{" "}
                <span className="font-semibold text-[#11110F]">
                  {barberName}
                </span>
              </p>
              <p className="text-[11px] text-[#6E6C65]">
                Layanan:{" "}
                <span className="font-semibold text-[#11110F]">
                  {serviceName}
                </span>{" "}
                ({serviceDurationMinutes} mnt)
              </p>
            </div>

            {/* New Schedule Preview */}
            <div className="space-y-1 sm:pl-1">
              <span className="font-bold uppercase text-[10px] tracking-wider text-[#2F7D4A]">
                Jadwal Baru yang Dipilih
              </span>
              {selectedSlot ? (
                <>
                  <p className="font-bold text-[#11110F]">
                    {formatDateIndonesian(selectedDate)}
                  </p>
                  <p className="font-semibold text-[#2F7D4A]">
                    {formatTimeWib(selectedSlot.startsAt)} -{" "}
                    {formatTimeWib(selectedSlot.endsAt)} WIB
                  </p>
                  <p className="text-[11px] text-[#6E6C65] pt-0.5">
                    Barber:{" "}
                    <span className="font-semibold text-[#11110F]">
                      {barberName}
                    </span>{" "}
                    (Tetap)
                  </p>
                  <p className="text-[11px] text-[#6E6C65]">
                    Layanan:{" "}
                    <span className="font-semibold text-[#11110F]">
                      {serviceName}
                    </span>
                  </p>
                </>
              ) : (
                <p className="text-[#6E6C65] italic text-[11px] pt-1">
                  Pilih tanggal & slot waktu di bawah ini.
                </p>
              )}
            </div>
          </div>

          {/* Same-time Slot Notice */}
          {isSameTimeSlot && (
            <div
              role="alert"
              data-testid="same-time-warning"
              className="p-3 bg-[#FAF8F3] border border-[#D8D4CA] rounded-xl flex items-center gap-2 text-xs font-semibold text-[#6E6C65]"
            >
              <AlertCircleIcon size={16} className="text-[#6E6C65] shrink-0" />
              <span>
                Waktu yang dipilih sama dengan jadwal saat ini. Silakan pilih
                jam atau tanggal lain.
              </span>
            </div>
          )}

          {/* Step 1: Select Date */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="reschedule-date-input"
                className="text-xs font-bold uppercase tracking-wider text-[#11110F] flex items-center gap-1.5"
              >
                <CalendarIcon size={15} />
                1. Pilih Tanggal Baru
              </label>
              <span className="text-[11px] text-[#6E6C65]">
                {formatDateIndonesian(selectedDate)}
              </span>
            </div>

            {/* Quick Date Slider using accessible native radio semantics */}
            <div
              role="radiogroup"
              aria-label="Pilihan Tanggal Cepat"
              className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin"
            >
              {selectableDates.map((item) => {
                const isSelected = selectedDate === item.dateStr;
                return (
                  <label
                    key={item.dateStr}
                    className={`shrink-0 flex flex-col items-center justify-center w-14 py-2 px-1 rounded-xl border transition-all cursor-pointer focus-within:ring-2 focus-within:ring-[#C9F23B] ${
                      isSelected
                        ? "bg-[#11110F] text-[#FAF8F3] border-[#11110F] shadow-xs ring-2 ring-[#C9F23B]"
                        : "bg-[#FAF8F3] text-[#11110F] border-[#D8D4CA] hover:border-[#11110F]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="reschedule-quick-date"
                      value={item.dateStr}
                      checked={isSelected}
                      onChange={() => handleSelectDate(item.dateStr)}
                      className="sr-only"
                    />
                    <span
                      className={`text-[9px] font-semibold uppercase ${
                        isSelected ? "text-[#C9F23B]" : "text-[#6E6C65]"
                      }`}
                    >
                      {item.isToday ? "Hari Ini" : item.dayName}
                    </span>
                    <span className="text-sm font-extrabold my-0.5">
                      {item.dayNumber}
                    </span>
                    <span
                      className={`text-[9px] ${
                        isSelected ? "text-[#FAF8F3]/80" : "text-[#6E6C65]"
                      }`}
                    >
                      {item.monthName}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Native Date Picker input for reachable future dates */}
            <div className="pt-1">
              <input
                id="reschedule-date-input"
                data-testid="reschedule-date-picker"
                type="date"
                min={getJakartaTodayString()}
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) {
                    handleSelectDate(e.target.value);
                  }
                }}
                className="w-full px-3 py-2 text-xs border border-[#D8D4CA] rounded-lg bg-[#FAF8F3] text-[#11110F] font-semibold focus:outline-none focus:ring-2 focus:ring-[#C9F23B]"
              />
            </div>
          </div>

          {/* Step 2: Select Time Slot */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#11110F] flex items-center gap-1.5">
                <ClockIcon size={15} />
                2. Pilih Waktu Tersedia
              </span>
              <span className="text-[11px] text-[#6E6C65]">
                Barber:{" "}
                <span className="font-semibold text-[#11110F]">
                  {barberName}
                </span>
              </span>
            </div>

            {/* Loading Slots Skeleton */}
            {isLoadingSlots && (
              <div
                role="status"
                aria-label="Memuat jadwal tersedia"
                data-testid="reschedule-loading-slots"
                className="space-y-2 py-2"
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <div
                      key={n}
                      className="h-12 bg-[#D8D4CA]/30 rounded-xl animate-pulse"
                    />
                  ))}
                </div>
                <p className="text-[11px] text-center text-[#6E6C65]">
                  Memuat jadwal barber...
                </p>
              </div>
            )}

            {/* Slot Fetch Error */}
            {!isLoadingSlots && slotFetchError && (
              <div
                role="alert"
                data-testid="reschedule-slot-fetch-error"
                className="p-4 text-center border border-[#B63D37]/30 bg-[#B63D37]/10 rounded-xl space-y-2"
              >
                <p className="text-xs text-[#B63D37] font-semibold">
                  {slotFetchError}
                </p>
                <button
                  type="button"
                  onClick={handleRetryFetchSlots}
                  className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-[#11110F] text-[#FAF8F3] rounded-lg hover:bg-[#22231F] focus:outline-none focus:ring-2 focus:ring-[#C9F23B]"
                >
                  Coba Lagi
                </button>
              </div>
            )}

            {/* Empty Slots */}
            {!isLoadingSlots && !slotFetchError && slots.length === 0 && (
              <div
                data-testid="reschedule-no-slots"
                className="p-6 text-center border border-[#D8D4CA] bg-[#FAF8F3] rounded-xl space-y-2"
              >
                <ClockIcon size={24} className="mx-auto text-[#6E6C65]" />
                <h4 className="text-xs font-bold text-[#11110F] uppercase">
                  Tidak Ada Jadwal Tersedia
                </h4>
                <p className="text-xs text-[#6E6C65] max-w-xs mx-auto">
                  Barber Anda tidak memiliki jam luang pada tanggal ini. Silakan
                  pilih tanggal lain.
                </p>
              </div>
            )}

            {/* Slots Grid using accessible native radio semantics */}
            {!isLoadingSlots && !slotFetchError && slots.length > 0 && (
              <div
                role="radiogroup"
                aria-label="Pilihan Waktu Baru"
                data-testid="reschedule-slots-grid"
                className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1 scrollbar-thin"
              >
                {slots.map((slot) => {
                  const isSelected = selectedSlot?.startsAt === slot.startsAt;
                  const isCurrentTime = isSameInstant(
                    slot.startsAt,
                    currentStartsAt,
                  );
                  const startTime = formatTimeWib(slot.startsAt);
                  const endTime = formatTimeWib(slot.endsAt);

                  return (
                    <label
                      key={slot.startsAt}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all cursor-pointer focus-within:ring-2 focus-within:ring-[#C9F23B] ${
                        isSelected
                          ? "bg-[#11110F] text-[#FAF8F3] border-[#11110F] shadow-xs ring-2 ring-[#C9F23B]"
                          : isCurrentTime
                            ? "bg-[#FAF8F3] border-[#D8D4CA] text-[#6E6C65] hover:border-[#11110F]"
                            : "bg-[#FAF8F3] text-[#11110F] border-[#D8D4CA] hover:border-[#11110F]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="reschedule-time-slot"
                        value={slot.startsAt}
                        checked={isSelected}
                        onChange={() => {
                          setSelectedSlot(slot);
                          setMutationError(null);
                        }}
                        className="sr-only"
                      />
                      <span className="text-sm font-extrabold tracking-tight">
                        {startTime}
                      </span>
                      <span
                        className={`text-[10px] ${
                          isSelected ? "text-[#C9F23B]" : "text-[#6E6C65]"
                        }`}
                      >
                        s.d. {endTime} WIB
                      </span>
                      {isCurrentTime && (
                        <span className="text-[9px] font-bold uppercase text-[#6E6C65] mt-0.5">
                          (Jadwal Saat Ini)
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-[#D8D4CA] bg-[#FAF8F3] flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
          <button
            type="button"
            data-testid="cancel-reschedule-dialog-button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#6E6C65] hover:text-[#11110F] transition-colors focus:outline-none focus:ring-2 focus:ring-[#C9F23B] rounded-xl disabled:opacity-40"
          >
            Batal
          </button>
          <button
            type="button"
            data-testid="confirm-reschedule-button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="w-full sm:w-auto px-6 py-2.5 text-xs font-bold uppercase tracking-wider bg-[#11110F] text-[#FAF8F3] rounded-xl transition-all hover:bg-[#22231F] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#C9F23B] shadow-xs flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div
                  className="w-3.5 h-3.5 border-2 border-[#FAF8F3]/30 border-t-[#FAF8F3] rounded-full animate-spin"
                  aria-hidden="true"
                />
                <span>Menyimpan Perubahan...</span>
              </>
            ) : (
              <span>Konfirmasi Ubah Jadwal</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
