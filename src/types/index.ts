export interface Vehicle {
  id: string;
  model: string;
  plate: string;
  nickName: string;
  image: string;
}

export interface Reservation {
  id?: string;
  requesterName: string;
  carId: string;
  startDate: number; // timestamp
  endDate: number; // timestamp
  requestDate: number; // timestamp
  status: 'approved' | 'pending' | 'cancelled';
}
