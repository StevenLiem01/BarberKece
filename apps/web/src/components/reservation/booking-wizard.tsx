"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  PublicServiceDto,
  PublicBarberDto,
  PublicAvailableSlotDto,
  AppointmentDto,
} from "@barberkece/contracts";
import {
  saveBookingDraft,
  getBookingDraft,
  clearBookingDraft,
  BookingDraft,
} from "@/lib/booking-draft";
import { StepIndicator } from "./step-indicator";
import { BookingSummarySidebar } from "./booking-summary-sidebar";
import { ServiceStep } from "./service-step";
import { BarberStep } from "./barber-step";
import { DateStep } from "./date-step";
import { TimeStep } from "./time-step";
import { ReviewStep } from "./review-step";
import { CheckIcon } from "@/components/ui/icons";

export interface BookingWizardProps {
  isAuthenticated: boolean;
  initialServices?: PublicServiceDto[];
  initialBarbers?: PublicBarberDto[];
}

export function BookingWizard({
  isAuthenticated,
  initialServices = [],
  initialBarbers = [],
}: BookingWizardProps) {
  const router = useRouter();

  // Navigation step: 1 = Service, 2 = Barber, 3 = Date, 4 = Time, 5 = Review
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form State
  const [selectedService, setSelectedService] =
    useState<PublicServiceDto | null>(null);
  const [isAnyBarber, setIsAnyBarber] = useState<boolean>(true);
  const [selectedBarber, setSelectedBarber] = useState<PublicBarberDto | null>(
    null,
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] =
    useState<PublicAvailableSlotDto | null>(null);
  const [notes, setNotes] = useState<string>("");

  // Server Data & Loading States
  const [services, setServices] = useState<PublicServiceDto[]>(initialServices);
  const [barbers, setBarbers] = useState<PublicBarberDto[]>(initialBarbers);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(
    initialServices.length === 0,
  );
  const [initialError, setInitialError] = useState<string | null>(null);

  // Availability Slots State
  const [availableSlots, setAvailableSlots] = useState<
    PublicAvailableSlotDto[]
  >([]);
  const [isSlotsLoading, setIsSlotsLoading] = useState<boolean>(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  // Submission & Recovery State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);

  // Idempotency Tracking & Request Race Prevention
  const pendingIdempotencyKeyRef = useRef<string | null>(null);
  const latestSlotsRequestIdRef = useRef<number>(0);

  // 1. Fetch initial catalog data if not provided via props
  const fetchCatalogData = useCallback(async () => {
    setIsInitialLoading(true);
    setInitialError(null);

    try {
      const [servicesRes, barbersRes] = await Promise.all([
        fetch("/api/v1/services"),
        fetch("/api/v1/barbers"),
      ]);

      if (!servicesRes.ok || !barbersRes.ok) {
        throw new Error("Gagal memuat katalog layanan dan barber");
      }

      const servicesData = await servicesRes.json();
      const barbersData = await barbersRes.json();

      setServices(servicesData.data ?? []);
      setBarbers(barbersData.data ?? []);
      return {
        servicesList: (servicesData.data ?? []) as PublicServiceDto[],
        barbersList: (barbersData.data ?? []) as PublicBarberDto[],
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memuat data awal";
      setInitialError(msg);
      return null;
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  // 2. Fetch Availability Slots with race-condition protection
  const fetchAvailableSlots = useCallback(
    async (
      serviceId: string,
      date: string,
      barberId: string | null,
    ): Promise<PublicAvailableSlotDto[]> => {
      const requestId = ++latestSlotsRequestIdRef.current;
      setIsSlotsLoading(true);
      setSlotsError(null);

      try {
        const params = new URLSearchParams({ serviceId, date });
        if (barberId) {
          params.set("barberProfileId", barberId);
        }

        const res = await fetch(
          `/api/v1/appointments/available-slots?${params.toString()}`,
        );
        const data = await res.json();

        if (!res.ok) {
          throw new Error(
            data.error?.message ?? "Gagal memuat ketersediaan slot",
          );
        }

        const slots = (data.data ?? []) as PublicAvailableSlotDto[];
        if (requestId === latestSlotsRequestIdRef.current) {
          setAvailableSlots(slots);
        }
        return slots;
      } catch (err: unknown) {
        if (requestId === latestSlotsRequestIdRef.current) {
          const msg =
            err instanceof Error
              ? err.message
              : "Gagal memuat ketersediaan slot";
          setSlotsError(msg);
          setAvailableSlots([]);
        }
        return [];
      } finally {
        if (requestId === latestSlotsRequestIdRef.current) {
          setIsSlotsLoading(false);
        }
      }
    },
    [],
  );

  // 3. Draft Restoration on Mount
  useEffect(() => {
    let isMounted = true;

    async function initWizard() {
      let currentServicesList = initialServices;
      let currentBarbersList = initialBarbers;

      if (currentServicesList.length === 0 || currentBarbersList.length === 0) {
        const fetched = await fetchCatalogData();
        if (fetched) {
          currentServicesList = fetched.servicesList;
          currentBarbersList = fetched.barbersList;
        }
      }

      if (!isMounted) return;

      // Check for transient booking draft
      const draft = getBookingDraft();
      if (!draft) return;

      const matchedService = currentServicesList.find(
        (s) => s.id === draft.serviceId,
      );
      if (!matchedService) {
        clearBookingDraft();
        return;
      }

      setSelectedService(matchedService);

      if (draft.barberProfileId) {
        const foundBarber = currentBarbersList.find(
          (b) => b.id === draft.barberProfileId,
        );
        if (foundBarber) {
          setIsAnyBarber(false);
          setSelectedBarber(foundBarber);
        } else {
          // Requested barber no longer active/found; fallback to any available
          setIsAnyBarber(true);
          setSelectedBarber(null);
        }
      } else {
        setIsAnyBarber(true);
        setSelectedBarber(null);
      }

      setSelectedDate(draft.date);
      setNotes(draft.notes ?? "");

      // Revalidate slot availability before restoring to Review step
      const freshSlots = await fetchAvailableSlots(
        draft.serviceId,
        draft.date,
        draft.barberProfileId,
      );

      if (!isMounted) return;

      const matchingSlot = freshSlots.find(
        (slot) =>
          slot.startsAt === draft.startsAt && slot.endsAt === draft.endsAt,
      );

      if (matchingSlot) {
        setSelectedSlot(matchingSlot);
        setCurrentStep(5); // Advance to Review
        setInfoNotice("Draf reservasi Anda telah dipulihkan.");
      } else {
        // Slot is no longer available; keep upstream selections, clear slot, stay at Step 4
        setSelectedSlot(null);
        setCurrentStep(4);
        setSubmitError(
          "Slot waktu yang Anda pilih sebelumnya sudah tidak tersedia. Silakan pilih slot baru.",
        );
      }
    }

    initWizard();

    return () => {
      isMounted = false;
    };
  }, [fetchCatalogData, fetchAvailableSlots, initialServices, initialBarbers]);

  // 4. Transition helper to step with slot prefetching when entering Step 4
  const goToStep = useCallback(
    (step: number) => {
      setCurrentStep(step);
      if (step === 4 && selectedService && selectedDate) {
        const barberId = isAnyBarber ? null : (selectedBarber?.id ?? null);
        fetchAvailableSlots(selectedService.id, selectedDate, barberId);
      }
    },
    [
      selectedService,
      selectedDate,
      isAnyBarber,
      selectedBarber,
      fetchAvailableSlots,
    ],
  );

  // Handler: Selecting a Service
  const handleSelectService = (service: PublicServiceDto) => {
    if (selectedService?.id !== service.id) {
      setSelectedService(service);
      // Invalidate downstream time slot selection
      setSelectedSlot(null);
      // Reset specific barber selection to prevent ineligible barber state
      if (selectedBarber !== null) {
        setSelectedBarber(null);
        setIsAnyBarber(true);
      }
    }
  };

  // Handler: Selecting Any Available Barber
  const handleSelectAnyBarber = () => {
    setIsAnyBarber(true);
    if (selectedBarber !== null) {
      setSelectedBarber(null);
      setSelectedSlot(null);
    }
  };

  // Handler: Selecting Specific Barber
  const handleSelectSpecificBarber = (barber: PublicBarberDto) => {
    if (isAnyBarber || selectedBarber?.id !== barber.id) {
      setIsAnyBarber(false);
      setSelectedBarber(barber);
      setSelectedSlot(null);
    }
  };

  // Handler: Selecting Date
  const handleSelectDate = (date: string) => {
    if (selectedDate !== date) {
      setSelectedDate(date);
      setSelectedSlot(null);
    }
  };

  // Handler: Selecting Slot
  const handleSelectSlot = (slot: PublicAvailableSlotDto) => {
    setSelectedSlot(slot);
    setSubmitError(null);
  };

  // Switch to Any Available from Time Step (e.g. When specific barber has no slots)
  const handleSwitchToAnyBarberFromTime = () => {
    setIsAnyBarber(true);
    setSelectedBarber(null);
    setSelectedSlot(null);
    if (selectedService && selectedDate) {
      fetchAvailableSlots(selectedService.id, selectedDate, null);
    }
  };

  // Step Navigation Check
  const canNavigateToStep = (targetStep: number): boolean => {
    if (targetStep === 1) return true;
    if (targetStep === 2) return selectedService !== null;
    if (targetStep === 3)
      return (
        selectedService !== null && (isAnyBarber || selectedBarber !== null)
      );
    if (targetStep === 4)
      return (
        selectedService !== null &&
        (isAnyBarber || selectedBarber !== null) &&
        selectedDate !== null
      );
    if (targetStep === 5)
      return (
        selectedService !== null &&
        (isAnyBarber || selectedBarber !== null) &&
        selectedDate !== null &&
        selectedSlot !== null
      );
    return false;
  };

  // Handler: Confirm Booking / Auth Interruption
  const handleConfirmBooking = async () => {
    if (!selectedService || !selectedDate || !selectedSlot) {
      setSubmitError("Informasi reservasi belum lengkap.");
      return;
    }

    // 6. Guest Auth Interruption: Save transient draft & redirect to /sign-in
    if (!isAuthenticated) {
      const draft: BookingDraft = {
        serviceId: selectedService.id,
        barberProfileId: isAnyBarber ? null : (selectedBarber?.id ?? null),
        date: selectedDate,
        startsAt: selectedSlot.startsAt,
        endsAt: selectedSlot.endsAt,
        notes: notes.trim() || null,
      };

      saveBookingDraft(draft);
      router.push("/sign-in?next=/book");
      return;
    }

    // 7. Authenticated Confirmation Flow
    if (isSubmitting) {
      return; // Prevent duplicate submission
    }

    setIsSubmitting(true);
    setSubmitError(null);

    // Reuse or create idempotency key for this confirmation attempt
    if (!pendingIdempotencyKeyRef.current) {
      pendingIdempotencyKeyRef.current =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : "idem-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
    }

    try {
      const payload = {
        serviceId: selectedService.id,
        startsAt: selectedSlot.startsAt,
        barberProfileId: isAnyBarber ? undefined : selectedBarber?.id,
        notes: notes.trim() || undefined,
      };

      const res = await fetch("/api/v1/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": pendingIdempotencyKeyRef.current,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 401) {
        // Session expired during checkout
        const draft: BookingDraft = {
          serviceId: selectedService.id,
          barberProfileId: isAnyBarber ? null : (selectedBarber?.id ?? null),
          date: selectedDate,
          startsAt: selectedSlot.startsAt,
          endsAt: selectedSlot.endsAt,
          notes: notes.trim() || null,
        };
        saveBookingDraft(draft);
        router.push("/sign-in?next=/book");
        return;
      }

      if (!res.ok) {
        const errMessage =
          data.error?.message ??
          "Terjadi kesalahan saat mengonfirmasi reservasi.";

        // Distinguish genuine slot/barber availability conflict from other errors
        const isAvailabilityConflict =
          res.status === 409 ||
          (res.status === 400 &&
            (errMessage.toLowerCase().includes("already booked") ||
              errMessage.toLowerCase().includes("not available") ||
              errMessage.toLowerCase().includes("conflict") ||
              errMessage.toLowerCase().includes("tidak tersedia")));

        if (isAvailabilityConflict) {
          // Preserve upstream selections, clear invalid slot, refresh slots, move to Step 4
          setSelectedSlot(null);
          goToStep(4);
          setSubmitError(errMessage);
          pendingIdempotencyKeyRef.current = null; // Reset idempotency key for new slot choice
          return;
        }

        // Other errors (e.g. 500 server error, validation error, customer conflict): remain on Review step, preserve slot & idempotency key for retry
        setSubmitError(errMessage);
        return;
      }

      // Success
      clearBookingDraft();
      pendingIdempotencyKeyRef.current = null;
      const appointment = data.data as AppointmentDto;
      router.push(`/book/confirmation/${appointment.bookingReference}`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Gagal terhubung ke server reservasi.";
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-[#11110F]">
          Reservasi BarberKece
        </h1>
        <p className="text-xs sm:text-sm text-[#6E6C65] mt-1">
          Pilih layanan, barber, dan waktu kunjungan untuk perawatan gaya rambut
          Anda.
        </p>
      </div>

      {/* General Notification / Recovery Alert */}
      {infoNotice && (
        <div
          role="status"
          className="mb-6 p-4 bg-[#2F7D4A]/10 border border-[#2F7D4A]/30 rounded-xl flex items-center justify-between text-xs text-[#2F7D4A]"
        >
          <div className="flex items-center gap-2">
            <CheckIcon size={16} />
            <span className="font-semibold">{infoNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setInfoNotice(null)}
            className="text-xs font-bold underline"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Step Indicator */}
      <div className="mb-8 p-4 bg-[#FAF8F3] border border-[#D8D4CA] rounded-xl">
        <StepIndicator
          currentStep={currentStep}
          onStepClick={(step) => goToStep(step)}
          canNavigateToStep={canNavigateToStep}
        />
      </div>

      {/* Main 65% Wizard / 35% Summary Rail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Wizard Column (col-span-8) */}
        <section
          aria-label="Langkah Pemesanan"
          className="lg:col-span-8 bg-[#FAF8F3] border border-[#D8D4CA] rounded-xl p-5 sm:p-7 shadow-xs"
        >
          {currentStep === 1 && (
            <ServiceStep
              services={services}
              isLoading={isInitialLoading}
              error={initialError}
              onRetry={fetchCatalogData}
              selectedService={selectedService}
              onSelectService={handleSelectService}
              onNext={() => goToStep(2)}
            />
          )}

          {currentStep === 2 && (
            <BarberStep
              barbers={barbers}
              isLoading={isInitialLoading}
              error={initialError}
              onRetry={fetchCatalogData}
              selectedBarber={selectedBarber}
              isAnyBarber={isAnyBarber}
              onSelectAnyBarber={handleSelectAnyBarber}
              onSelectSpecificBarber={handleSelectSpecificBarber}
              onBack={() => goToStep(1)}
              onNext={() => goToStep(3)}
            />
          )}

          {currentStep === 3 && (
            <DateStep
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              onBack={() => goToStep(2)}
              onNext={() => goToStep(4)}
            />
          )}

          {currentStep === 4 && (
            <TimeStep
              slots={availableSlots}
              isLoading={isSlotsLoading}
              error={slotsError}
              onRetry={() => {
                if (selectedService && selectedDate) {
                  const barberId = isAnyBarber
                    ? null
                    : (selectedBarber?.id ?? null);
                  fetchAvailableSlots(
                    selectedService.id,
                    selectedDate,
                    barberId,
                  );
                }
              }}
              selectedSlot={selectedSlot}
              onSelectSlot={handleSelectSlot}
              isSpecificBarber={!isAnyBarber}
              onSwitchToAnyBarber={handleSwitchToAnyBarberFromTime}
              onChangeDate={() => goToStep(3)}
              onBack={() => goToStep(3)}
              onNext={() => goToStep(5)}
            />
          )}

          {currentStep === 5 &&
            selectedService &&
            selectedDate &&
            selectedSlot && (
              <ReviewStep
                service={selectedService}
                barber={selectedBarber}
                isAnyBarber={isAnyBarber}
                date={selectedDate}
                slot={selectedSlot}
                notes={notes}
                onNotesChange={setNotes}
                isAuthenticated={isAuthenticated}
                isSubmitting={isSubmitting}
                submitError={submitError}
                onConfirm={handleConfirmBooking}
                onBack={() => goToStep(4)}
              />
            )}
        </section>

        {/* Summary Sidebar Column (col-span-4) */}
        <div className="lg:col-span-4 sticky top-6">
          <BookingSummarySidebar
            service={selectedService}
            barber={selectedBarber}
            isAnyBarber={isAnyBarber}
            date={selectedDate}
            slot={selectedSlot}
          />
        </div>
      </div>
    </div>
  );
}
