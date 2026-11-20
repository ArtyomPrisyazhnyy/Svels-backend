import { MigrationInterface, QueryRunner } from 'typeorm';

export class W5BLoyStreak1792100000000 implements MigrationInterface {
  name = 'W5BLoyStreak1792100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "guest_loyalty_balances" ADD "streakStartedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest_loyalty_balances" ADD "lastVisitDay" date`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest_loyalty_balances" ADD "streakDays" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest_loyalty_balances" ADD "longestStreak" integer NOT NULL DEFAULT '0'`,
    );

    await queryRunner.query(`
      WITH visit_days AS (
        SELECT
          lv."restaurantId",
          lv."userId",
          (lv."createdAt" AT TIME ZONE 'Europe/Minsk')::date AS visit_day,
          MIN(lv."createdAt") AS first_at_on_day
        FROM loyalty_visits lv
        GROUP BY
          lv."restaurantId",
          lv."userId",
          (lv."createdAt" AT TIME ZONE 'Europe/Minsk')::date
      ),
      visit_days_with_expire AS (
        SELECT
          vd.*,
          COALESCE(rls."flameExpireDays", 14) AS expire_days,
          vd.visit_day
            - LAG(vd.visit_day) OVER (
              PARTITION BY vd."restaurantId", vd."userId"
              ORDER BY vd.visit_day
            ) AS day_gap
        FROM visit_days vd
        LEFT JOIN restaurant_loyalty_settings rls
          ON rls."restaurantId" = vd."restaurantId"
      ),
      streak_groups AS (
        SELECT
          vde.*,
          SUM(
            CASE
              WHEN vde.day_gap IS NULL OR vde.day_gap > vde.expire_days THEN 1
              ELSE 0
            END
          ) OVER (
            PARTITION BY vde."restaurantId", vde."userId"
            ORDER BY vde.visit_day
          ) AS streak_group
        FROM visit_days_with_expire vde
      ),
      streak_stats AS (
        SELECT
          sg."restaurantId",
          sg."userId",
          sg.streak_group,
          MIN(sg.first_at_on_day) AS streak_started_at,
          MAX(sg.visit_day) AS last_visit_day,
          COUNT(*)::integer AS streak_len
        FROM streak_groups sg
        GROUP BY sg."restaurantId", sg."userId", sg.streak_group
      ),
      per_user AS (
        SELECT DISTINCT ON (ss."restaurantId", ss."userId")
          ss."restaurantId",
          ss."userId",
          ss.streak_started_at,
          ss.last_visit_day,
          ss.streak_len
        FROM streak_stats ss
        ORDER BY ss."restaurantId", ss."userId", ss.streak_group DESC
      ),
      longest AS (
        SELECT
          ss."restaurantId",
          ss."userId",
          MAX(ss.streak_len)::integer AS longest_streak
        FROM streak_stats ss
        GROUP BY ss."restaurantId", ss."userId"
      ),
      merged AS (
        SELECT
          pu."restaurantId",
          pu."userId",
          pu.streak_started_at,
          pu.last_visit_day,
          pu.streak_len,
          lg.longest_streak
        FROM per_user pu
        INNER JOIN longest lg
          ON lg."restaurantId" = pu."restaurantId"
          AND lg."userId" = pu."userId"
      )
      UPDATE guest_loyalty_balances glb
      SET
        "streakStartedAt" = m.streak_started_at,
        "lastVisitDay" = m.last_visit_day,
        "streakDays" = m.streak_len,
        "longestStreak" = m.longest_streak
      FROM merged m
      WHERE glb."restaurantId" = m."restaurantId"
        AND glb."userId" = m."userId"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "guest_loyalty_balances" DROP COLUMN "longestStreak"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest_loyalty_balances" DROP COLUMN "streakDays"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest_loyalty_balances" DROP COLUMN "lastVisitDay"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest_loyalty_balances" DROP COLUMN "streakStartedAt"`,
    );
  }
}
