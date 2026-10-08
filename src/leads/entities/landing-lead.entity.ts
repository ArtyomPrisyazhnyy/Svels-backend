import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Заявка с лендинга Svels (форма «Оставить заявку»).
 * Способы связи хранятся отдельными boolean-колонками — проще для аналитики
 * и не требует массивов/enum на уровне БД.
 */
@Entity('landing_leads')
export class LandingLead {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 40 })
  phone: string;

  @Column({ type: 'boolean', default: false })
  contactTelegram: boolean;

  @Column({ type: 'boolean', default: false })
  contactWhatsapp: boolean;

  @Column({ type: 'boolean', default: false })
  contactViber: boolean;

  @Column({ type: 'varchar', length: 2000, nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  source: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
