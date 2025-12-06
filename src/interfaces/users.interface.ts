export interface Location {
  latitude: number;
  longitude: number;
  address: string;
  placeId: string;
}

export interface User {
  _id: string;
  email: string;
  password: string;
  role: 'admin' | 'user' | 'barber';
  username: string;
  phoneNumber: string;
  gender: 'male' | 'female' | 'other';
  location?: Location;
}
