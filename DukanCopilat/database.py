import json
import os
import sqlite3

from contextlib import contextmanager


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INSTANCE_DIR = os.path.join(BASE_DIR, "instance")
DATABASE_PATH = os.path.join(INSTANCE_DIR, "dukaancopilot.db")

os.makedirs(INSTANCE_DIR, exist_ok=True)


DEFAULT_SETTINGS = {
    "name": "Urban Threads PK",
    "category": "Clothing and accessories",
    "shipping": {
        "karachi": "2-4 working days",
        "other_cities": "3-6 working days",
        "standard_fee": "PKR 200",
        "free_shipping_threshold": "PKR 5,000",
    },
    "return_policy": (
        "Exchanges are accepted within 7 days of delivery "
        "for unused items in their original condition. "
        "The store team must confirm eligibility."
    ),
    "payment_methods": [
        "Cash on Delivery",
        "Bank transfer",
    ],
    "support_hours": (
        "Monday-Saturday, 10:00 AM-7:00 PM Pakistan time"
    ),
}


DEFAULT_PRODUCTS = [
    {
        "name": "Classic Denim Jacket",
        "price": "PKR 3,499",
        "availability": "In stock",
        "description": "A classic blue denim jacket.",
    },
    {
        "name": "Oversized Cotton Hoodie",
        "price": "PKR 2,799",
        "availability": "In stock",
        "description": "A comfortable everyday cotton hoodie.",
    },
    {
        "name": "Everyday Tote Bag",
        "price": "PKR 899",
        "availability": "Limited stock",
        "description": "A reusable everyday carry bag.",
    },
]


DEFAULT_FAQS = [
    {
        "question": "What payment methods do you accept?",
        "answer": (
            "The store accepts Cash on Delivery and bank transfer."
        ),
    },
    {
        "question": "What is the standard shipping fee?",
        "answer": (
            "Standard shipping costs PKR 200. "
            "Free shipping applies to orders of PKR 5,000 or more."
        ),
    },
    {
        "question": "What is your exchange policy?",
        "answer": (
            "Exchanges are accepted within 7 days of delivery "
            "for unused items in their original condition. "
            "The store team must confirm eligibility."
        ),
    },
]


@contextmanager
def get_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row

    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize_database():
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                price TEXT NOT NULL,
                availability TEXT NOT NULL,
                description TEXT NOT NULL,
                icon TEXT NOT NULL DEFAULT ''
            )
        """)

        connection.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        """)

        connection.execute("""
            CREATE TABLE IF NOT EXISTS faqs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question TEXT NOT NULL,
                answer TEXT NOT NULL
            )
        """)

        connection.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_question TEXT NOT NULL,
                ai_reply TEXT NOT NULL,
                model TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Support databases created by earlier app versions.
        columns = connection.execute(
            "PRAGMA table_info(products)"
        ).fetchall()

        column_names = {column["name"] for column in columns}

        if "icon" not in column_names:
            connection.execute("""
                ALTER TABLE products
                ADD COLUMN icon TEXT NOT NULL DEFAULT ''
            """)

        for key, value in DEFAULT_SETTINGS.items():
            connection.execute(
                """
                INSERT OR IGNORE INTO settings (key, value)
                VALUES (?, ?)
                """,
                (
                    key,
                    json.dumps(value, ensure_ascii=False),
                ),
            )

        product_count = connection.execute(
            "SELECT COUNT(*) FROM products"
        ).fetchone()[0]

        if product_count == 0:
            connection.executemany(
                """
                INSERT INTO products
                    (name, price, availability, description, icon)
                VALUES (?, ?, ?, ?, ?)
                """,
                [
                    (
                        item["name"],
                        item["price"],
                        item["availability"],
                        item["description"],
                        "",
                    )
                    for item in DEFAULT_PRODUCTS
                ],
            )

        faq_count = connection.execute(
            "SELECT COUNT(*) FROM faqs"
        ).fetchone()[0]

        if faq_count == 0:
            connection.executemany(
                """
                INSERT INTO faqs (question, answer)
                VALUES (?, ?)
                """,
                [
                    (item["question"], item["answer"])
                    for item in DEFAULT_FAQS
                ],
            )


def get_store_profile():
    with get_connection() as connection:
        setting_rows = connection.execute(
            "SELECT key, value FROM settings"
        ).fetchall()

        product_rows = connection.execute("""
            SELECT id, name, price, availability, description
            FROM products
            ORDER BY id
        """).fetchall()

        faq_rows = connection.execute("""
            SELECT id, question, answer
            FROM faqs
            ORDER BY id
        """).fetchall()

    settings = {
        row["key"]: json.loads(row["value"])
        for row in setting_rows
    }

    return {
        "name": settings["name"],
        "category": settings["category"],
        "products": [dict(row) for row in product_rows],
        "shipping": settings["shipping"],
        "return_policy": settings["return_policy"],
        "payment_methods": settings["payment_methods"],
        "support_hours": settings["support_hours"],
        "faqs": [dict(row) for row in faq_rows],
    }


def update_store_settings(updated_settings):
    with get_connection() as connection:
        for key, value in updated_settings.items():
            connection.execute(
                """
                INSERT INTO settings (key, value)
                VALUES (?, ?)
                ON CONFLICT(key)
                DO UPDATE SET value = excluded.value
                """,
                (
                    key,
                    json.dumps(value, ensure_ascii=False),
                ),
            )


def create_product(product):
    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO products
                (name, price, availability, description, icon)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                product["name"],
                product["price"],
                product["availability"],
                product["description"],
                "",
            ),
        )

        return cursor.lastrowid


def update_product(product_id, product):
    with get_connection() as connection:
        cursor = connection.execute(
            """
            UPDATE products
            SET name = ?,
                price = ?,
                availability = ?,
                description = ?,
                icon = ''
            WHERE id = ?
            """,
            (
                product["name"],
                product["price"],
                product["availability"],
                product["description"],
                product_id,
            ),
        )

        return cursor.rowcount > 0


def delete_product(product_id):
    with get_connection() as connection:
        cursor = connection.execute(
            "DELETE FROM products WHERE id = ?",
            (product_id,),
        )

        return cursor.rowcount > 0


def create_faq(question, answer):
    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO faqs (question, answer)
            VALUES (?, ?)
            """,
            (question, answer),
        )

        return cursor.lastrowid


def update_faq(faq_id, question, answer):
    with get_connection() as connection:
        cursor = connection.execute(
            """
            UPDATE faqs
            SET question = ?, answer = ?
            WHERE id = ?
            """,
            (question, answer, faq_id),
        )

        return cursor.rowcount > 0


def delete_faq(faq_id):
    with get_connection() as connection:
        cursor = connection.execute(
            "DELETE FROM faqs WHERE id = ?",
            (faq_id,),
        )

        return cursor.rowcount > 0


def save_conversation(question, reply, model):
    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO conversations
                (customer_question, ai_reply, model)
            VALUES (?, ?, ?)
            """,
            (question, reply, model),
        )

        row = connection.execute(
            """
            SELECT id, customer_question, ai_reply, model, created_at
            FROM conversations
            WHERE id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()

        return dict(row)


def get_recent_conversations(limit=10):
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, customer_question, ai_reply, model, created_at
            FROM conversations
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return [dict(row) for row in rows]