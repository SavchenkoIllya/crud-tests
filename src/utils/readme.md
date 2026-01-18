### Примеры HTTP‑запросов для вашего парсера (разной сложности)
Ниже — готовые query string’и (как их послать к вашему `/health`), плюс кратко, что из них получится в `req.drizzleQuery` при использовании текущего `subjectQuerySchema`.

Schema напоминание:
- Таблица: subjects — поля `id`, `name`, `departmentId`
- Relation: `department` — поля `id`, `name`, `description`
- Aggregate whitelist: `count` (по `subjects.id`)

---

#### 1) Базовый: выбрать конкретные поля и отфильтровать по колонке
URL:
```
GET /health?select[id]=1&select[name]=1&filter[name]=Algebra&limit=10
```
Что означает:
- select: брать `subjects.id`, `subjects.name`
- filter: `subjects.name = 'Algebra'`
- limit: 10

Примерно во что превратится:
```ts
req.drizzleQuery = {
  columns: { id: true, name: true },
  where: /* eq(subjects.name, 'Algebra') */, 
  orderBy: [],
  limit: 10,
  offset: undefined,
  aggregates: undefined,
};
```

---

#### 2) С relation: выбрать у subject и несколько полей из department
URL (массив полей relation — через `[]`):
```
GET /health?select[id]=1&select[name]=1&select[department][]=id&select[department][]=name
```
Что означает:
- select: `subjects.id`, `subjects.name`
- with: relation `department` с полями `id`, `name`

Результат:
```ts
req.drizzleQuery = {
  columns: { id: true, name: true },
  with: { department: { columns: { id: true, name: true } } },
};
```

---

#### 3) Сортировка по колонке и по полю relation
URL:
```
GET /health?sort[name]=asc&sort[department][name]=desc
```
Что означает:
- orderBy: `subjects.name ASC`, затем `department.name DESC`

Результат (логически):
```ts
req.drizzleQuery = {
  orderBy: [
    /* asc(subjects.name) */, 
    /* desc(departments.name) */
  ]
};
```

---

#### 4) Фильтры по relation + пагинация (limit/offset)
URL:
```
GET /health?filter[department][name]=Math&limit=20&offset=40
```
Что означает:
- where: `departments.name = 'Math'`
- limit: 20, offset: 40

Результат:
```ts
req.drizzleQuery = {
  where: /* eq(departments.name, 'Math') */, 
  limit: 20,
  offset: 40,
};
```

---

#### 5) Агрегация (count) без выборки записей
URL (значение ключа не важно, важен сам ключ `count`):
```
GET /health?aggregate[count]=1
```
Что означает:
- aggregates: `count(subjects.id) as "count"`

Результат:
```ts
req.drizzleQuery = {
  aggregates: [ /* count(subjects.id).as('count') */ ]
};
```

---

#### 6) Комплексный пример: select + relation + фильтры + многоступенчатая сортировка + агрегация + пагинация
URL:
```
GET /health
  ?select[id]=1
  &select[name]=1
  &select[department][]=id
  &select[department][]=name
  &filter[name]=Algebra
  &filter[department][description]=Science
  &sort[department][name]=asc
  &sort[id]=desc
  &aggregate[count]=1
  &limit=50
  &offset=0
```
Что означает:
- select: `subjects.id`, `subjects.name`, with `department(id, name)`
- where: `subjects.name = 'Algebra'` AND `departments.description = 'Science'`
- orderBy: `department.name ASC`, затем `subjects.id DESC`
- aggregates: `count(subjects.id) as count`
- limit: 50, offset: 0

Результат:
```ts
req.drizzleQuery = {
  columns: { id: true, name: true },
  with: { department: { columns: { id: true, name: true } } },
  where: /* and(eq(subjects.name, 'Algebra'), eq(departments.description, 'Science')) */,
  orderBy: [ /* asc(departments.name) */, /* desc(subjects.id) */ ],
  aggregates: [ /* count(subjects.id).as('count') */ ],
  limit: 50,
  offset: 0,
};
```

---

#### Подсказки по синтаксису query‑строк
- Выбор relation полей — только массивом: `select[relation][]=field1&select[relation][]=field2`.
- Сортировка по relation: `sort[relation][field]=asc|desc`.
- Фильтр по relation: `filter[relation][field]=value`.
- Положительные целые для `limit`/`offset`; пустые/отрицательные/нечисловые — игнорируются парсером.
- `aggregate[count]=...` — любое значение; парсер проверяет наличие ключа `count` в whitelist и добавляет `count()`.

Если хотите, могу подготовить примеры `curl` с полными URL и показать, как результат подставить в `db.query.subjects.findMany(...)`. 