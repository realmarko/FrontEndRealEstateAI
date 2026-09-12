import { Agent } from '../models/agent.model';

export interface AgentDto {
  id: number;
  name: string;
  email: string;
  phone: string;
  company?: string | null;
  photoUrl?: string | null;
  propertiesCount: number;
}

export function fromDto(dto: AgentDto): Agent {
  return {
    id: dto.id,
    name: dto.name,
    email: dto.email,
    phone: dto.phone,
    company: dto.company ?? undefined,
    photoUrl: dto.photoUrl ?? undefined,
    propertiesCount: dto.propertiesCount
  };
}
