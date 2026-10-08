export enum UserRole {
  USER = 'user',
  /** Владелец заведения: полный доступ, в том числе найм сотрудников. */
  RESTAURANT_ADMIN = 'restaurant_admin',
  /** Управляющий: операции заведения без эквайринга, домена и сотрудников. */
  RESTAURANT_MANAGER = 'restaurant_manager',
  /** Зал / приём: брони и живые заказы. */
  RESTAURANT_HALL = 'restaurant_hall',
  /** Производство (кухня / сборка): только очередь заказов. */
  RESTAURANT_PRODUCTION = 'restaurant_production',
  SUPER_ADMIN = 'super_admin',
}
