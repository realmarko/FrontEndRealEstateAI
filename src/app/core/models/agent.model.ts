export interface Agent {
  id: number;
  name: string;
  email: string;
  phone: string;
  company?: string;
  photoUrl?: string;
  propertiesCount: number;
}

export interface AgentProfileInput {
  phone: string;
  company?: string;
  photo?: File;
}
