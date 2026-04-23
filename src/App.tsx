/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { VEHICLES } from './constants/vehicles';
import { Reservation, Vehicle } from './types';
import { subscribeToReservations, deleteReservation, archiveOldReservations } from './services/reservationService';
import { Car, Calendar, ShieldCheck, Trash2, Edit3, Lock, LogOut, CheckCircle, Search, Clock, ChevronRight, List, Download, Eraser, Key, AlertTriangle, ExternalLink, Info, Loader2 } from 'lucide-react';
import { format, isSameMonth, isSameYear } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import BookingForm from './components/BookingForm';

export function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-white border border-slate-200 shadow-xl px-12 py-6 text-center relative group overflow-hidden min-w-[320px]">
      <div className="absolute top-0 left-0 w-full h-1.5 bg-maroon-800" />
      <div className="flex flex-col items-center pt-2">
        <div className="flex items-baseline gap-2">
          <p className="text-4xl font-display font-black text-maroon-900 uppercase tracking-tight tabular-nums leading-none">
            {format(time, 'hh:mm:ss')}
          </p>
          <span className="text-sm font-display font-black text-gold-600 uppercase">
            {format(time, 'aa')}
          </span>
        </div>
        <span className="text-[9px] font-bold text-maroon-800/40 uppercase tracking-[0.1em] mt-2">Precision Sync Active</span>
      </div>
      <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:rotate-12 group-hover:scale-110 transition-all duration-700">
        <Clock size={80} className="text-maroon-800" />
      </div>
    </div>
  );
}

export function App() {
  // State
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [verifyModal, setVerifyModal] = useState<{ res: Reservation; action: 'edit' | 'delete' } | null>(null);
  const [verifyFirstName, setVerifyFirstName] = useState('');
  const [verifyLastName, setVerifyLastName] = useState('');
  const [verifyError, setVerifyError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const unsub = subscribeToReservations(setReservations);
    return () => unsub();
  }, []);

  const triggerSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const isCarAvailableNow = (carId: string) => {
    const now = Date.now();
    return !reservations.some(r => r.carId === carId && r.status === 'approved' && now >= r.startDate && now <= r.endDate);
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPin === '7324') {
      setIsAdmin(true);
      setIsLoggedIn(true);
      setStaffName('Administrator');
      setAdminPin('');
      triggerSuccess('Admin access enabled');
    } else {
      alert('Invalid PIN');
    }
  };

  const handleVerify = async () => {
    if (!verifyModal || isProcessing) return;
    
    const { res, action } = verifyModal;
    const vFName = verifyFirstName.trim();
    const vLName = verifyLastName.trim();

    // If admin is in the modal (fallback), they don't need name validation
    if (!isAdmin && (!vFName || !vLName)) {
      alert('Please enter both First and Last Name for authorization.');
      return;
    }

    const verifiedName = `${vFName} ${vLName}`;
    const isAuthorized = isAdmin || verifiedName.toLowerCase() === res.requesterName.toLowerCase().trim();

    if (isAuthorized) {
      setIsProcessing(true);
      try {
        if (action === 'edit') {
          const vehicle = VEHICLES.find(v => v.id === res.carId);
          if (vehicle) {
            setSelectedVehicle(vehicle);
            setEditingReservation(res);
            setShowBookingForm(true);
            setVerifyModal(null);
            setVerifyFirstName('');
            setVerifyLastName('');
            setVerifyError(false);
          } else {
            alert('Vehicle reference found corrupted.');
          }
        } else {
          const resId = res.id;
          if (!resId) throw new Error("Missing ID");
          
          await deleteReservation(resId);
          triggerSuccess('Log Permanently Erased');
          setVerifyModal(null);
          setVerifyFirstName('');
          setVerifyLastName('');
          setVerifyError(false);
        }
      } catch (err: any) {
        alert('Action Interrupted: ' + (err.message || 'Unknown Error'));
      } finally {
        setIsProcessing(false);
      }
    } else {
      setVerifyError(true);
    }
  };

  const activeReservations = reservations
    .filter(r => {
      const resDate = new Date(r.startDate);
      const now = new Date();
      // Show if it's this month, this year, or in the future
      return (isSameMonth(resDate, now) && isSameYear(resDate, now)) || resDate > now;
    });

  const exportToCSV = () => {
    const now = new Date();
    const headers = ['Staff Name', 'Assigned Vehicle', 'Plate', 'From', 'Until', 'Requested On'];
    const rows = [...activeReservations]
      .sort((a, b) => a.startDate - b.startDate)
      .map(r => {
        const v = VEHICLES.find(veh => veh.id === r.carId);
        return [
          r.requesterName, 
          v?.nickName || '', 
          v?.plate || '', 
          format(r.startDate, 'MM/dd'), 
          format(r.endDate, 'MM/dd'),
          r.requestDate ? format(r.requestDate, 'yyyy-MM-dd HH:mm') : '---'
        ];
      });

    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `Fleet_Report_${format(now, 'MMM_yyyy')}.csv`;
    a.click();
    triggerSuccess('CSV Exported');
  };

  const handleWipe = async () => {
    if (confirm('Wipe old archives?')) {
      try { await archiveOldReservations(); triggerSuccess('Board Cleaned & Archived'); } catch (err: any) { alert('Failed: ' + err.message); }
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const fName = firstName.trim();
    const lName = lastName.trim();

    if (!fName || !lName) {
      alert('Please complete both First Name and Last Name fields.');
      return;
    }

    const combinedName = `${fName} ${lName}`;
    setIsLoggedIn(true);
    setStaffName(combinedName);
    setFirstName(fName);
    setLastName(lName);
    triggerSuccess(`Welcome, ${combinedName}`);
  };

  const logout = () => {
    setIsLoggedIn(false);
    setIsAdmin(false);
    setFirstName('');
    setLastName('');
    setStaffName('');
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-maroon-950 flex items-center justify-center p-6 font-sans relative overflow-hidden">
        {/* Deep Institutional Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-maroon-900 via-maroon-950 to-black opacity-80" />
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000, #000 1px, transparent 1px, transparent 20px)' }} />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="bg-white max-w-xl w-full rounded-none shadow-[0_50px_100px_-20px_rgba(0,0,0,0.6)] text-center relative z-10 overflow-hidden border border-maroon-800/10"
        >
          {/* Presidential Top Bar */}
          <div className="h-4 bg-maroon-800" />
          <div className="h-1 bg-gold-500" />

          <div className="p-10 space-y-12">
            <div className="flex flex-col items-center pt-2">
              <h2 className="text-3xl font-display font-black text-maroon-900 uppercase tracking-tighter sm:text-4xl leading-none mb-4">
                ILTEXAS AOH
              </h2>
              <h2 className="text-3xl font-display font-black text-maroon-900 uppercase tracking-tighter sm:text-4xl leading-none">
                CAR REQUEST PORTAL
              </h2>
              <div className="flex items-center justify-center gap-4 mt-8 w-full px-4">
                <div className="h-px bg-slate-100 flex-grow" />
              </div>
            </div>

            <div className="space-y-12 divide-y divide-slate-100">
              {/* Personnel Login Section */}
              <div className="space-y-6 text-left">
                <div className="flex items-center gap-4 mb-2">
                   <div className="h-0.5 w-8 bg-maroon-800" />
                   <h3 className="text-[10px] font-black text-maroon-800 uppercase tracking-widest">Staff Access</h3>
                </div>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">First Name</p>
                      <input 
                        type="text" 
                        placeholder="e.g. John" 
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-none focus:outline-none focus:border-maroon-800 transition-all font-semibold shadow-sm placeholder:text-slate-200"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Last Name</p>
                      <input 
                        type="text" 
                        placeholder="e.g. Doe" 
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-none focus:outline-none focus:border-maroon-800 transition-all font-semibold shadow-sm placeholder:text-slate-200"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    className="w-full py-5 bg-maroon-800 text-gold-400 font-display font-black text-lg uppercase tracking-[0.2em] hover:bg-maroon-900 transition-all shadow-lg active:scale-[0.98]"
                  >
                    Sign IN
                  </button>
                </form>
              </div>

              {/* Administrative Login Section */}
              <div className="space-y-6 text-left pt-12">
                <div className="flex items-center gap-4 mb-2">
                   <div className="h-0.5 w-8 bg-gold-500" />
                   <h3 className="text-[10px] font-black text-gold-600 uppercase tracking-widest">Administrative Access</h3>
                </div>
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Override PIN</p>
                    <div className="relative group cursor-text">
                      <input 
                        type="password" 
                        maxLength={4}
                        className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-text"
                        value={adminPin}
                        onChange={(e) => setAdminPin(e.target.value.replace(/[^0-9]/g, ''))}
                        autoFocus
                      />
                      <div className={`w-full px-6 py-4 bg-slate-50 border transition-all rounded-none flex items-center justify-center gap-4 text-3xl font-black h-[66px] shadow-sm ${adminPin ? 'border-maroon-800' : 'border-slate-100 group-hover:border-slate-200'}`}>
                        {[0, 1, 2, 3].map((i) => (
                          <div key={i} className="w-8 flex justify-center">
                            {adminPin.length > i ? (
                              <span className="text-maroon-900 animate-in zoom-in-50 duration-200">*</span>
                            ) : (
                              <span className="text-slate-200">*</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    className="w-full py-5 bg-white border-2 border-maroon-800 text-maroon-800 font-display font-black text-[10px] uppercase tracking-[0.2em] hover:bg-maroon-50 transition-all active:scale-[0.98]"
                  >
                    Admin Authorization
                  </button>
                </form>
              </div>
            </div>
            
            <div className="flex items-center justify-center gap-4 text-[10px] font-bold text-slate-300 uppercase tracking-widest pt-4">
              <ShieldCheck size={14} />
              <span>Institutional Protocol Active</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-maroon-800 selection:text-white pb-32 relative overflow-hidden">
      {/* Institutional Pattern Layer */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none z-0" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000, #000 1px, transparent 1px, transparent 20px)' }} />

      {/* Institutional Header */}
      <header className="sticky top-0 z-40 bg-white border-b-4 border-gold-500 shadow-xl transition-all duration-500">
        <div className="max-w-7xl mx-auto px-8 h-28 flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-6"
          >
             <div className="flex flex-col justify-between h-14 py-1">
               <span className="text-xl font-display font-black tracking-tighter text-maroon-800 uppercase leading-none sm:text-2xl lg:text-3xl">ILTEXAS AOH</span>
               <h1 className="text-xl font-display font-black tracking-tighter text-maroon-800 leading-none uppercase sm:text-2xl lg:text-3xl whitespace-nowrap">
                 CAR REQUEST PORTAL
               </h1>
               <div className="flex items-center gap-2 mt-1">
                 <div className={`w-2 h-2 ${isAdmin ? 'bg-indigo-500' : 'bg-gold-500'} rounded-full animate-pulse`} />
                 <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">
                   {isAdmin ? 'System Administrator' : `Staff: ${staffName}`}
                 </span>
               </div>
             </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-6"
          >
            <button 
              onClick={() => { setSelectedVehicle(null); setShowBookingForm(true); }}
              className="px-8 py-4 bg-maroon-800 text-gold-400 rounded-none font-display font-black text-[11px] uppercase tracking-[0.2em] hover:bg-maroon-900 transition-all active:scale-95 shadow-lg flex items-center gap-3 group border border-maroon-700"
            >
              <Calendar className="w-4 h-4" />
              Book Vehicle
            </button>
            <div className="w-px h-10 bg-slate-100 hidden sm:block" />
            <div className="flex items-center gap-2">
              {isAdmin && (
                <>
                  <button onClick={exportToCSV} title="Download CSV" className="p-4 text-slate-400 hover:text-maroon-800 transition-all"><Download size={20}/></button>
                  <button onClick={handleWipe} title="Wipe Old Records" className="p-4 text-slate-400 hover:text-rose-600 transition-all"><Eraser size={20}/></button>
                </>
              )}
              <button 
                onClick={logout} 
                className="flex items-center gap-3 px-6 py-4 border border-slate-200 text-slate-500 font-display font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all active:scale-95 group shadow-sm bg-white"
              >
                <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </motion.div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-20 space-y-32 relative z-10">
        {/* Current Date Display */}
        <section className="border-b-4 border-slate-200 pb-12 flex flex-col sm:flex-row items-center justify-between gap-8">
           <div className="flex flex-col gap-2 text-center sm:text-left">
              <span className="text-maroon-800 font-display font-black text-xs uppercase tracking-[0.5em]"></span>
              <div className="flex items-center gap-4 justify-center sm:justify-start">
                 <div className="w-1.5 h-12 bg-gold-500" />
                 <h2 className="text-5xl sm:text-6xl font-display font-black text-maroon-900 uppercase tracking-tighter leading-none">
                    {format(new Date(), 'MMMM dd, yyyy')}
                 </h2>
              </div>
           </div>
           
           <LiveClock />
        </section>

        {/* Select a Vehicle Grid */}
        <section>
          <div className="flex items-center gap-8 mb-16 border-l-8 border-maroon-800 pl-8">
            <div>
              <h2 className="text-5xl font-display font-black text-maroon-800 tracking-tight uppercase">Select a Vehicle</h2>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {VEHICLES.map((v, idx) => {
              // Only show "Assigned" status for TODAY's date, but keep the card active.
              const assignedToday = !isCarAvailableNow(v.id);
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.05 }}
                  key={v.id} 
                  className="group bg-white rounded-none border border-slate-200 shadow-sm hover:shadow-2xl transition-all duration-500 relative flex flex-col pt-1"
                >
                  <div className={`h-1.5 w-full ${assignedToday ? 'bg-maroon-800' : 'bg-gold-500'}`} />
                  
                  <div className="p-10 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-8">
                       <div className={`w-14 h-14 border flex items-center justify-center transition-all group-hover:bg-maroon-800 group-hover:text-gold-400 duration-500 bg-slate-50 border-slate-100 text-maroon-800`}>
                          <Car className="w-6 h-6" />
                       </div>
                       <span className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] font-display border ${assignedToday ? 'bg-maroon-50 border-maroon-100 text-maroon-700' : 'bg-gold-50 border-gold-200 text-gold-700'}`}>
                          {assignedToday ? 'Assigned' : 'Available'}
                       </span>
                    </div>
                    
                    <div className="mb-auto">
                       <h4 className="text-xl font-display font-black text-maroon-800 leading-tight group-hover:text-gold-600 transition-colors uppercase tracking-tight">{v.nickName}</h4>
                       <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest mt-2">{v.plate} <span className="mx-2 opacity-50">•</span> {v.model}</p>
                    </div>

                    <button 
                      onClick={() => { setSelectedVehicle(v); setShowBookingForm(true); }}
                      className={`mt-10 w-full py-4 font-display font-black text-[10px] uppercase tracking-[0.2em] transition-all border bg-maroon-800 text-gold-400 border-maroon-700 hover:bg-maroon-900 shadow-lg active:scale-95`}
                    >
                      Select Unit
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Operational Activity Log */}
        <section>
          <div className="flex items-center gap-8 mb-16 border-l-8 border-gold-500 pl-8">
            <div>
              <h3 className="text-4xl font-display font-black text-maroon-800 tracking-tight uppercase">Operational Activity</h3>
            </div>
          </div>
          <div className="bg-white rounded-none border border-slate-200 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] overflow-hidden">
             <div className="p-8 bg-slate-50/50 border-b border-slate-100 grid grid-cols-[1.3fr_1fr_1fr_1fr_100px] items-center text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] px-16">
                <span className="text-left">Staff Name</span>
                <span className="text-left">Assigned Vehicle</span>
                <span className="text-center">Date of Use</span>
                <span className="text-center">Requesting Date</span>
                <span className=""></span>
             </div>

             <div className="flex flex-col relative divide-y divide-slate-100">
                <AnimatePresence mode="popLayout">
                  {activeReservations.length === 0 ? (
                    <motion.div key="empty" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-60 text-center flex flex-col items-center justify-center">
                       <div className="w-28 h-28 bg-white shadow-2xl shadow-indigo-100 rounded-[3rem] flex items-center justify-center mb-8 border border-slate-50">
                         <Info size={44} className="text-indigo-200" />
                       </div>
                       <p className="text-xl font-display font-black text-slate-300 uppercase tracking-widest">No active logs found</p>
                    </motion.div>
                  ) : (
                    activeReservations
                      .sort((a, b) => a.startDate - b.startDate)
                      .map((res, idx) => {
                        const vehicle = VEHICLES.find(v => v.id === res.carId);
                        const isNow = Date.now() >= res.startDate && Date.now() <= res.endDate;
                        
                        return (
                          <motion.div 
                            layout
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9, x: 20 }}
                            key={`${res.id || idx}`} 
                            className={`group grid grid-cols-[1.3fr_1fr_1fr_1fr_100px] items-center px-16 py-12 border-b border-slate-100 hover:bg-slate-50 transition-all duration-500 relative ${isNow ? 'bg-maroon-50/60 ring-2 ring-inset ring-maroon-800/10' : ''}`}
                          >
                            {isNow && <div className="absolute inset-y-0 left-0 w-2.5 bg-maroon-800 shadow-[2px_0_15px_rgba(128,0,0,0.4)]" />}
                            
                            <div className="flex items-center gap-6">
                               <div className={`w-14 h-14 rounded-none border flex items-center justify-center flex-shrink-0 font-display font-black text-xl shadow-sm transition-all duration-500 ${isNow ? 'bg-maroon-800 text-gold-400 border-maroon-700' : 'bg-slate-50 text-slate-300 group-hover:bg-white group-hover:text-maroon-800 group-hover:border-slate-200'}`}>
                                 {res.requesterName.charAt(0)}
                               </div>
                               <div className="flex flex-col gap-1">
                                 <span className="text-lg font-display font-black text-maroon-900 leading-tight uppercase tracking-tight">{res.requesterName}</span>
                                 {isNow && (
                                   <div className="flex items-center gap-1.5">
                                      <div className="w-1.5 h-1.5 bg-gold-500 rounded-full animate-pulse" />
                                      <span className="text-[9px] font-black uppercase text-maroon-800 tracking-[0.1em] font-sans">Deployment Active</span>
                                   </div>
                                 )}
                               </div>
                            </div>

                            <div className="text-left">
                               <div className="flex flex-col gap-1">
                                 <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{vehicle?.nickName}</span>
                                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{vehicle?.plate}</span>
                                 {isNow && (
                                   <motion.div 
                                     initial={{ opacity: 0, x: -5 }}
                                     animate={{ opacity: 1, x: 0 }}
                                     className="mt-2"
                                   >
                                     <span className="inline-flex items-center gap-2 px-3 py-1 bg-maroon-800 text-gold-400 text-[8px] font-black uppercase tracking-widest rounded-none shadow-[4px_4px_0_rgba(128,0,0,0.2)] border border-maroon-700">
                                       <div className="relative flex h-2 w-2">
                                         <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold-400 opacity-75"></span>
                                         <span className="relative inline-flex rounded-full h-2 w-2 bg-gold-500"></span>
                                       </div>
                                       Car In Use Today
                                     </span>
                                   </motion.div>
                                 )}
                               </div>
                            </div>

                            <div className="flex flex-col items-center gap-2">
                               <div className="flex items-center gap-3 bg-white px-5 py-2.5 rounded-none border border-slate-200 transition-all shadow-sm">
                                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{format(res.startDate, 'MMM d')}</span>
                                 <div className="w-3 h-px bg-slate-300" />
                                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{format(res.endDate, 'MMM d')}</span>
                               </div>
                            </div>

                            <div className="flex flex-col items-center justify-center">
                               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">
                                 {res.requestDate ? format(res.requestDate, 'MMM d, p') : '---'}
                               </span>
                            </div>

                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                               <button 
                                 type="button"
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   if (isAdmin) {
                                     const vehicle = VEHICLES.find(v => v.id === res.carId);
                                     if (vehicle) {
                                       setSelectedVehicle(vehicle);
                                       setEditingReservation(res);
                                       setShowBookingForm(true);
                                     }
                                   } else {
                                     setVerifyModal({ res, action: 'edit' });
                                   }
                                 }} 
                                 className="p-3 text-slate-300 hover:text-maroon-800 transition-all active:scale-95"
                               >
                                 <Edit3 size={16} />
                               </button>
                               <button 
                                 type="button"
                                 onClick={async (e) => {
                                   e.stopPropagation();
                                   if (!res.id) {
                                      alert("Identifier lookup error.");
                                      return;
                                   }
                                   // Admins use the modal for consistency but it skips name entry
                                   setVerifyModal({ res, action: 'delete' });
                                 }} 
                                 className="p-3 text-slate-300 hover:text-rose-600 transition-all active:scale-95"
                               >
                                 <Trash2 size={16} />
                               </button>
                            </div>
                          </motion.div>
                        );
                      })
                  )}
                </AnimatePresence>
             </div>
          </div>
        </section>
      </main>

      {/* Friendly Modals */}
      <AnimatePresence>
        {showBookingForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center p-8 backdrop-blur-3xl bg-slate-900/40">
            <motion.div initial={{ scale: 0.85, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85, y: 50 }} className="w-full max-w-xl">
              <BookingForm 
                initialVehicle={selectedVehicle || undefined} 
                editingReservation={editingReservation || undefined}
                existingReservations={reservations}
                currentUser={staffName}
                isAdmin={isAdmin}
                onCancel={() => { setSelectedVehicle(null); setEditingReservation(null); setShowBookingForm(false); }}
                onSuccess={() => { setSelectedVehicle(null); setEditingReservation(null); setShowBookingForm(false); triggerSuccess(editingReservation ? 'Record Updated' : 'Booking Logged'); }}
              />
            </motion.div>
          </motion.div>
        )}

        {verifyModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[150] flex items-center justify-center p-8 backdrop-blur-sm bg-maroon-900/40">
            <motion.div 
              initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
              className="bg-white p-16 rounded-none shadow-2xl max-w-xl w-full text-center border-t-8 border-gold-500"
            >
              <div className={`w-24 h-24 ${verifyModal.action === 'delete' ? 'bg-rose-50 text-rose-600' : 'bg-gold-50 text-gold-600'} flex items-center justify-center mx-auto mb-10 border border-current opacity-70`}>
                <AlertTriangle className="w-12 h-12" />
              </div>
              <h3 className="text-4xl font-display font-black text-maroon-800 mb-4 uppercase">{verifyModal.action === 'delete' ? 'Erase Record?' : 'Authorize Change'}</h3>
              <div className="bg-slate-50 border border-slate-100 p-4 mb-8 inline-block mx-auto">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Record Owner</span>
                <span className="text-xl font-display font-black text-maroon-900 uppercase">{verifyModal.res.requesterName}</span>
              </div>
              <p className="text-slate-400 text-sm mb-12 font-medium max-w-sm mx-auto leading-relaxed">
                {isAdmin ? "Admin permissions active. This action will be memorialized in the permanent operational log." : `This record belongs to ${verifyModal.res.requesterName}. Please re-enter your First and Last Name as shown above to authorize this action.`}
              </p>
              {!isAdmin && (
                <div className="space-y-4 mb-12">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1 text-left">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">First Name</p>
                        <input autoFocus type="text" placeholder="John" className={`w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-none focus:border-maroon-800 outline-none transition-all font-display font-black text-xl text-center ${verifyError ? 'text-rose-500 border-rose-500' : 'text-slate-900'}`} value={verifyFirstName} onChange={(e) => { setVerifyFirstName(e.target.value); setVerifyError(false); }} />
                      </div>
                      <div className="space-y-1 text-left">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Last Name</p>
                        <input type="text" placeholder="Doe" className={`w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-none focus:border-maroon-800 outline-none transition-all font-display font-black text-xl text-center ${verifyError ? 'text-rose-500 border-rose-500' : 'text-slate-900'}`} value={verifyLastName} onChange={(e) => { setVerifyLastName(e.target.value); setVerifyError(false); }} />
                      </div>
                   </div>
                   {verifyError && <motion.p initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="text-[9px] font-black text-rose-600 uppercase tracking-widest text-center mt-4">Unauthorized — Identity Mismatch</motion.p>}
                </div>
              )}
              <div className="flex gap-6">
                 <button onClick={() => { setVerifyModal(null); setVerifyFirstName(''); setVerifyLastName(''); setVerifyError(false); }} className="flex-1 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-maroon-800 transition-colors">Discard Request</button>
                 <button 
                  onClick={handleVerify} 
                  disabled={isProcessing}
                  className={`flex-1 py-5 ${verifyModal.action === 'delete' ? 'bg-rose-600' : 'bg-maroon-800'} text-white font-display font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2`}
                 >
                   {isProcessing && <Loader2 className="w-4 h-4 animate-spin text-gold-400" />}
                   {isProcessing ? 'Processing' : (verifyModal.action === 'delete' ? 'Finalize Deletion' : 'Confirm Change')}
                 </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {successMsg && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[200] bg-maroon-800 text-gold-400 px-10 py-5 rounded-none shadow-2xl flex items-center gap-5 border-l-4 border-gold-500">
            <CheckCircle className="w-5 h-5 text-gold-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] pt-0.5 whitespace-nowrap">{successMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
