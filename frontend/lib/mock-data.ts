export type Endpoint = {
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  name: string;
};

export type Domain = {
  id: string;
  name: string;
  baseUrl: string;
  createdAt: string;
  status: "healthy" | "warning" | "error";
  endpoints: Endpoint[];
};

export const mockDomains: Domain[] = [
  { 
    id: "domain_1", name: "User Service API", baseUrl: "https://api.acme.com/users", createdAt: "2023-10-12", status: "healthy",
    endpoints: [
      { id: "e1_1", method: "GET", path: "/", name: "List Users" },
      { id: "e1_2", method: "POST", path: "/", name: "Create User" },
      { id: "e1_3", method: "GET", path: "/{id}", name: "Get User by ID" },
      { id: "e1_4", method: "PUT", path: "/{id}", name: "Update User" },
      { id: "e1_5", method: "DELETE", path: "/{id}", name: "Delete User" },
      { id: "e1_6", method: "GET", path: "/{id}/preferences", name: "Get User Preferences" },
      { id: "e1_7", method: "PUT", path: "/{id}/preferences", name: "Update Preferences" },
      { id: "e1_8", method: "POST", path: "/{id}/verify", name: "Verify Email" },
      { id: "e1_9", method: "POST", path: "/{id}/reset-password", name: "Reset Password" },
      { id: "e1_10", method: "GET", path: "/{id}/activity", name: "Get Activity Logs" },
    ]
  },
  { 
    id: "domain_2", name: "Payment Gateway", baseUrl: "https://api.acme.com/payments", createdAt: "2023-11-05", status: "warning",
    endpoints: [
      { id: "e2_1", method: "POST", path: "/charge", name: "Create Charge" },
      { id: "e2_2", method: "GET", path: "/charge/{id}", name: "Retrieve Charge" },
      { id: "e2_3", method: "POST", path: "/refund", name: "Create Refund" },
      { id: "e2_4", method: "GET", path: "/refund/{id}", name: "Retrieve Refund" },
      { id: "e2_5", method: "GET", path: "/customers", name: "List Customers" },
      { id: "e2_6", method: "POST", path: "/customers", name: "Create Customer" },
      { id: "e2_7", method: "GET", path: "/customers/{id}", name: "Get Customer" },
      { id: "e2_8", method: "DELETE", path: "/customers/{id}", name: "Delete Customer" },
      { id: "e2_9", method: "POST", path: "/customers/{id}/sources", name: "Add Card" },
      { id: "e2_10", method: "DELETE", path: "/customers/{id}/sources/{cardNum}", name: "Remove Card" },
      { id: "e2_11", method: "GET", path: "/disputes", name: "List Disputes" },
      { id: "e2_12", method: "POST", path: "/disputes/{id}/close", name: "Close Dispute" },
    ]
  },
  { 
    id: "domain_3", name: "Inventory Sync", baseUrl: "https://inventory.acme.com/api/v1", createdAt: "2024-01-20", status: "healthy",
    endpoints: [
      { id: "e3_1", method: "GET", path: "/products", name: "List Products" },
      { id: "e3_2", method: "POST", path: "/products", name: "Add Product" },
      { id: "e3_3", method: "GET", path: "/products/{id}", name: "Get Product Details" },
      { id: "e3_4", method: "PUT", path: "/products/{id}", name: "Update Product" },
      { id: "e3_5", method: "DELETE", path: "/products/{id}", name: "Remove Product" },
      { id: "e3_6", method: "GET", path: "/products/{id}/stock", name: "Check Stock" },
      { id: "e3_7", method: "POST", path: "/products/{id}/stock/adjust", name: "Adjust Stock" },
      { id: "e3_8", method: "GET", path: "/warehouses", name: "List Warehouses" },
    ]
  },
  { 
    id: "domain_4", name: "Notification Hub", baseUrl: "https://notify.acme.com/v2", createdAt: "2024-02-15", status: "error",
    endpoints: [
      { id: "e4_1", method: "POST", path: "/send/email", name: "Send Email" },
      { id: "e4_2", method: "POST", path: "/send/sms", name: "Send SMS" },
      { id: "e4_3", method: "POST", path: "/send/push", name: "Send Push Notification" },
      { id: "e4_4", method: "GET", path: "/templates", name: "List Templates" },
      { id: "e4_5", method: "POST", path: "/templates", name: "Create Template" },
      { id: "e4_6", method: "GET", path: "/templates/{id}", name: "Get Template" },
      { id: "e4_7", method: "PUT", path: "/templates/{id}", name: "Update Template" },
      { id: "e4_8", method: "DELETE", path: "/templates/{id}", name: "Delete Template" },
      { id: "e4_9", method: "GET", path: "/logs", name: "Delivery Logs" },
      { id: "e4_10", method: "GET", path: "/metrics", name: "Delivery Metrics" },
    ]
  },
  { 
    id: "domain_5", name: "Analytics Engine", baseUrl: "https://api.acme.com/analytics", createdAt: "2024-03-01", status: "healthy",
    endpoints: [
      { id: "e5_1", method: "POST", path: "/events", name: "Track Event" },
      { id: "e5_2", method: "POST", path: "/events/batch", name: "Track Batch Events" },
      { id: "e5_3", method: "GET", path: "/metrics/active-users", name: "Active Users" },
      { id: "e5_4", method: "GET", path: "/metrics/retention", name: "Retention Rate" },
      { id: "e5_5", method: "GET", path: "/metrics/revenue", name: "Revenue Metrics" },
      { id: "e5_6", method: "POST", path: "/reports/generate", name: "Generate Report" },
      { id: "e5_7", method: "GET", path: "/reports/{id}", name: "Download Report" },
      { id: "e5_8", method: "GET", path: "/segments", name: "List User Segments" },
      { id: "e5_9", method: "POST", path: "/segments", name: "Create Segment" },
    ]
  }
];
