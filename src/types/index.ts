export type UserStatus = 'pending' | 'approved' | 'rejected' | 'banned';

export interface User {
  id: string;
  name: string;
  phone: string;
  password?: string;
  address?: string;
  rabiaCredit: number; // in Tomans
  status: UserStatus;
  creditSignature?: string;
  banReason?: string;
  bannedAt?: string;
  securityAlert?: string;
  createdAt: string;
}

export type MenuCategory = 
  | 'espresso_milk'
  | 'hot_bar'
  | 'tea_bar'
  | 'ice_coffee'
  | 'mocktail_bar'
  | 'shake_smoothie'
  | 'signature'
  | 'antioxidant_bar'
  | 'affogato_bar'
  | 'cakes_desserts'
  | 'refresher';

export interface MenuItem {
  id: string;
  name: string;
  nameEn: string;
  category: MenuCategory;
  price: number; // in Tomans
  description: string;
  ingredients: string[];
  image: string;
  isAvailable: boolean;
  isFeatured?: boolean;
}

export interface CartItem {
  item: MenuItem;
  quantity: number;
}

export type OrderType = 'takeaway' | 'dine_in';
export type PaymentMethod = 'rabia_credit' | 'counter_pos';
export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

export interface OrderItemRecord {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId?: string;
  userName: string;
  userPhone: string;
  orderType: OrderType;
  address?: string;
  tableNumber?: string;
  items: OrderItemRecord[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  createdAt: string;
  notes?: string;
  estimatedPrepMinutes?: number;
  prepStartedAt?: string;
  estimatedReadyAt?: string;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  userPhone: string;
  userName: string;
  amount: number; // positive = added, negative = deducted
  type: 'admin_charge' | 'order_payment' | 'in_person_order';
  description: string;
  createdAt: string;
  adminNote?: string;
}

export interface CafeStats {
  todayRevenue: number;
  todayOrdersCount: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  yearlyRevenue: number;
  totalCustomers: number;
}
