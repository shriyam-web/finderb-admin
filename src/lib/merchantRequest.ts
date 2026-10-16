export type MerchantRequest = {
  id: string;
  name: string;
  email: string;
  category: string;
  date: string;
  registrationNumber: string | null;
  onboardSource: "self" | "admin" | null;
  createdAt: string | null;
};
