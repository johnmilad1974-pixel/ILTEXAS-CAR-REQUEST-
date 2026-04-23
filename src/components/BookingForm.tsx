import React, { useState, useEffect } from 'react';
import { Vehicle, Reservation } from '../types';
import { User, Calendar, Loader2, AlertCircle, Save, X, Car, Info, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { format, addDays, startOfToday, areIntervalsOverlapping, endOfMonth } from 'date-fns';
import { createReservation, updateReservation } from '../services/reservationService';
import { VEHICLES } from '../constants/vehicles';

interface BookingFormProps {
  initialVehicle?: Vehicle;
  editingReservation?: Reservation;
  existingReservations: Reservation[];
  currentUser: string;
  isAdmin: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function BookingForm({ initialVehicle, editingReservation, existingReservations, currentUser, isAdmin, onSuccess, onCancel }: BookingFormProps) {
  const [selectedCarId, setSelectedCarId] = useState(editingReservation?.carId || initialVehicle?.id || '');
  const [name, setName] = useState(editingReservation?.requesterName || currentUser);
  const [startDate, setStartDate] = useState(
    editingReservation 
      ? format(new Date(editingReservation.startDate), 'yyyy-MM-dd') 
      : format(startOfToday(), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState(
    editingReservation 
      ? format(new Date(editingReservation.endDate), 'yyyy-MM-dd') 
      : format(addDays(startOfToday(), 1), 'yyyy-MM-dd')
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate the maximum allowed booking date: end of current month + 7 days
  const today = startOfToday();
  const lastDayOfMonth = endOfMonth(today);
  const nextMonthLimit = addDays(lastDayOfMonth, 7);
  
  // Exception: Admin and Carlos Chaanine can book throughout the entire year (and beyond)
  const normalizedName = name.toLowerCase().trim();
  const isCarlos = normalizedName === 'carlos chaanine';
  const isExempt = isAdmin || isCarlos;
  const maxDateStr = isExempt ? undefined : format(nextMonthLimit, 'yyyy-MM-dd');

  const selectedVehicle = VEHICLES.find(v => v.id === selectedCarId);

  const isAvailable = () => {
    try {
      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T23:59:59');
      
      return !existingReservations.some(res => {
        // Skip current reservation being edited
        if (editingReservation && res.id === editingReservation.id) return false;
        
        return res.carId === selectedCarId && res.status === 'approved' && areIntervalsOverlapping(
          { start, end },
          { start: new Date(res.startDate), end: new Date(res.endDate) },
          { inclusive: true }
        );
      });
    } catch {
      return false;
    }
  };

  const available = isAvailable();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!selectedCarId) {
      setError('Please select a vehicle from the dropdown.');
      return;
    }
    if (!available) {
      setError('Selected vehicle is not available for these dates.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T23:59:59');

      if (editingReservation?.id) {
        await updateReservation(editingReservation.id, {
          carId: selectedCarId,
          requesterName: name,
          startDate: start.getTime(),
          endDate: end.getTime(),
          status: editingReservation.status || 'approved',
          requestDate: editingReservation.requestDate || Date.now(),
        });
      } else {
        await createReservation({
          requesterName: name,
          carId: selectedCarId,
          startDate: start.getTime(),
          endDate: end.getTime(),
          requestDate: Date.now(),
          status: 'approved'
        });
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to process booking.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-none overflow-hidden shadow-2xl max-w-lg w-full border border-slate-200 relative">
      <div className="bg-maroon-800 px-10 py-10 text-white relative overflow-hidden border-b-4 border-gold-500">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl opacity-30" />
        <button 
          onClick={onCancel}
          className="absolute top-8 right-8 p-3 hover:bg-white/10 transition-colors z-10"
        >
          <X className="w-5 h-5 text-gold-400" />
        </button>
        <div className="flex items-center gap-4 mb-3">
          <div className="w-1.5 h-6 bg-gold-500" />
        </div>
        <h3 className="text-3xl font-display font-black tracking-tight uppercase">{editingReservation ? 'Edit Operational Log' : 'New Log Authorization'}</h3>
      </div>

      <form onSubmit={handleSubmit} className="p-12 space-y-8">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">
              Select Vehicle to Book
            </label>
            <div className="relative group">
              <Car className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-maroon-800 transition-colors" />
              <select
                className="w-full pl-14 pr-12 py-5 bg-slate-50 border border-slate-200 focus:border-maroon-800 rounded-none outline-none transition-all text-sm font-bold appearance-none cursor-pointer hover:bg-slate-100"
                value={selectedCarId}
                onChange={(e) => setSelectedCarId(e.target.value)}
              >
                {!initialVehicle && !editingReservation && (
                  <option value="" disabled>--- Choose an Asset ---</option>
                )}
                {VEHICLES.map(v => (
                  <option key={v.id} value={v.id}>{v.nickName.toUpperCase()} — {v.model}</option>
                ))}
              </select>
              <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronRight className="w-4 h-4 text-slate-400 rotate-90" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">
              Command Personnel
            </label>
            <div className="relative group">
              <User className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input
                readOnly
                type="text"
                className="w-full pl-14 pr-6 py-4 bg-slate-100 border border-slate-200 rounded-none outline-none font-bold text-slate-500 cursor-not-allowed"
                value={name}
              />
            </div>
            <p className="text-[9px] font-medium text-slate-400 mt-1 pl-1 capitalize">Identified via secure session as {name}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">
                Date of Use
              </label>
              <div className="relative group">
                <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-maroon-800 transition-colors" />
                <input
                  required
                  type="date"
                  className="w-full pl-14 pr-4 py-4 bg-slate-50 border border-slate-200 focus:border-maroon-800 rounded-none outline-none transition-all font-bold text-xs"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={format(startOfToday(), 'yyyy-MM-dd')}
                  max={maxDateStr}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">
                Date of Return
              </label>
              <div className="relative group">
                <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-maroon-800 transition-colors" />
                <input
                  required
                  type="date"
                  className="w-full pl-14 pr-4 py-4 bg-slate-50 border border-slate-200 focus:border-maroon-800 rounded-none outline-none transition-all font-bold text-xs"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  max={maxDateStr}
                />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-4 bg-rose-50 text-rose-700 border border-rose-100 flex items-center gap-3 text-xs font-bold uppercase tracking-tight">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>Operational Conflict: {error}</span>
          </motion.div>
        )}

        <div className="pt-4 relative group">
          {!available && selectedCarId && (
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-4 py-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl z-50">
               Not available to book — please choose another day
               <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45" />
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !available || !selectedCarId}
            className={`w-full py-5 px-8 rounded-none font-display font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-xl ${
              available && selectedCarId
                ? 'bg-maroon-800 text-gold-400 hover:bg-maroon-900 shadow-maroon-100/50 active:scale-[0.98]' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
            }`}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-gold-400" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{editingReservation ? 'Commit Modifications' : (available ? 'Available to Book' : 'Not Available')}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
