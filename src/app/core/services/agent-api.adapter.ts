import { Agent } from '../models/agent.model';

export interface AgentDto {
  id: number;
  name: string;
  email: string;
  phone: string;
  propertiesCount: number;
}

export function fromDto(dto: AgentDto): Agent {
  return {
    id: dto.id,
    name: dto.name,
    email: dto.email,
    phone: dto.phone,
    propertiesCount: dto.propertiesCount
  };
}
