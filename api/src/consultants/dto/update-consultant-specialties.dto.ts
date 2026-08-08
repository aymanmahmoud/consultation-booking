import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

// PUT semantics: this is the full desired set of specialty ids, not a
// list to add. The service replaces whatever's currently assigned with
// exactly this set (F-09's "assign / remove own specialties" in one call).
export class UpdateConsultantSpecialtiesDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  specialtyIds: string[];
}
