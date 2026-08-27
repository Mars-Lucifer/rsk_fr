"""Секция контента второго дня: 39 карточек под номера тайлов.

Кладётся в тот же каталог, что и остальные колоды (MAYAK_CONTENT_DIR из
.env.local), отдельным слогом `day2`. Существующие секции не трогаются: слог
новый, в манифест добавляется одной строкой.

Три типа карточек, по одному на такт (ТЗ, раздел Б):

    11        деталь      такт 1   18 штук
    11-12     узел        такт 2    9 штук
    11-12:adapter  переходник такт 2   9 штук
    10        изделие     такт 3    3 штуки

Номер карточки — это ключ, которым её открывает разбор ввода
(`mayakDay2Input.parseDay2Input`), а не позиция в колоде: у второго дня
диапазон слога не значит ничего. Двоеточие в номере переходника —
тот же ключ, что отдаёт парсер; в имя файла он не попадает, у этих
карточек нет вложений.

Тексты пока рыба из примеров ТЗ (разделы Б1-Б4). Настоящие соберёт модуль А
из расшифровки встречи конкретной организации.

Запуск:
    python scripts/make-day2-section.py [--dir C:/tmp/mayak-deck]
"""

import argparse
import json
import os
import re
import sys

SLUG = "day2"

RAYS = [
    (1, "Знания и навыки"),
    (2, "Внешние взаимодействия"),
    (3, "Данные и аналитика"),
    (4, "Автоматизация"),
    (5, "Единое цифровое пространство"),
    (6, "Защита данных"),
]
TABLES = [(1, "Среда", "Чем мы располагаем и чего не хватает?"),
          (2, "Деятельность", "Успеваем ли, и что нужно доделать?"),
          (3, "Сознание", "Как передать то, что уже прожили?")]

PARTNER = {1: 2, 2: 1, 3: 4, 4: 3, 5: 6, 6: 5}


def env_content_dir():
    """Каталог контента из .env.local — тот же, что читает платформа."""
    try:
        with open(".env.local", encoding="utf-8") as f:
            found = re.search(r"^MAYAK_CONTENT_DIR=(.+)$", f.read(), re.M)
            return found.group(1).strip() if found else None
    except OSError:
        return None


CHECKLIST = ("есть адрес, открывается по ссылке · открывается с чужого телефона · "
             "данные настоящие, не «тест-тест» · отвечает на вопрос дня · "
             "пустое состояние не пугает · есть держатель и приёмщик")

# Правило такта 2 из Б2: не про содержание, а про то, как пара работает руками.
PAIR_RULE = ("Пишете вдвоём один запрос. Один держит клавиатуру, второй говорит. "
             "Меняетесь каждые десять минут.")


def card(number, title, content_type, partner=""):
    """Карточка колоды. Поля вложений пустые: у второго дня их пока нет."""
    return {
        "number": number, "title": title,
        "contentType": content_type, "partnerNumber": partner,
        "file": "", "instruction": "", "map": "",
        "hasFile": False, "hasInstruction": False, "hasMap": False,
        "toolLink1": "", "toolName1": "", "toolLink2": "", "toolName2": "",
    }


def cards_and_texts():
    cards, texts = [], []
    for tens, table_label, day_question in TABLES:
        centre = str(tens * 10)
        cards.append(card(centre, f"Изделие · {table_label}", "Сборка"))
        texts.append({
            "number": centre,
            "question": day_question,
            "description": "Три пары сошлись в кольцо. Дальше собирается одно изделие, "
                           "и приёмочные проверки пишутся до того, как оно появится.",
            "task": "Собрать изделие команды. Единое цифровое пространство диктует, "
                    "печатает Автоматизация. Остальные четверо пишут приёмочные проверки "
                    "своих швов. Сдать: адрес, открывающийся по ссылке.",
            "dueMidday": f"Чек-лист готовности: {CHECKLIST}.",
        })

        for pos, ray_label in RAYS:
            number = str(tens * 10 + pos)
            partner = str(tens * 10 + PARTNER[pos])
            cards.append(card(number, ray_label, "Деталь", partner))
            texts.append({
                "number": number,
                "question": "Какой вопрос перестанут задавать голосом, когда это заработает?",
                "description": "Рыба. Настоящую историю подставит модуль А: прямая речь "
                               "из расшифровки встречи, с автором и датой.",
                "task": f"Сделать свою часть продукта по лучу «{ray_label}». "
                        f"Сдать: ссылка на файл. После обеда соединяетесь с {partner}.",
                "dueMidday": "Рыба. Критерий готовности подставит модуль А.",
            })

        # Узел и переходник — на пару, не на человека. Ключ по возрастанию: тот же,
        # что нормализует парсер, иначе `14 13` не найдёт карточку.
        for low_pos in (1, 3, 5):
            low = tens * 10 + low_pos
            high = tens * 10 + PARTNER[low_pos]
            pair = f"{low}-{high}"
            names = f"{dict(RAYS)[low_pos]} + {dict(RAYS)[PARTNER[low_pos]]}"

            # Название короткое: в шапке карточки оно стоит рядом с номером,
            # и «13-14 · Узел 13+14» читается как заикание.
            cards.append(card(pair, "Узел", "Узел"))
            texts.append({
                "number": pair,
                "question": "Рыба. Вопрос узла подставит модуль А.",
                "description": f"Шов {names}. Что должно получиться — рыба, "
                               f"настоящее описание даст модуль А.",
                "task": f"{PAIR_RULE} Сдать: один запрос на двоих.",
                "dueMidday": "По чему видно, что соединились: рыба, наблюдаемое событие "
                             "подставит модуль А.",
            })

            adapter = f"{pair}:adapter"
            cards.append(card(adapter, "Переходник", "Переходник"))
            texts.append({
                "number": adapter,
                "question": "Чего не хватает между вашими частями?",
                "description": "Это нормально и так задумано. Из шести деталей вещь "
                               "не собирается — при стыковке всегда обнаруживается то, "
                               "чего не было ни у кого.",
                "task": "Не переделывайте свои детали. Пишите запрос только "
                        "на недостающее звено. Сдать: один запрос, одна вещь.",
                "dueMidday": "Недостающее звено названо и описано отдельно от обеих частей.",
            })
    return cards, texts


def check(cards, texts):
    """Колода бьётся с тем, что открывает парсер. Расхождение ловится здесь,
    а не участником в 14:00 экраном «карточки 13-14 нет в этой секции»."""
    numbers = [c["number"] for c in cards]
    assert len(numbers) == len(set(numbers)), "номера не уникальны"
    assert numbers == [t["number"] for t in texts], "index.json и TaskText.json разошлись"

    kinds = {"detail": 0, "node": 0, "adapter": 0, "assembly": 0}
    for number in numbers:
        if number.endswith(":adapter"):
            kinds["adapter"] += 1
        elif "-" in number:
            kinds["node"] += 1
        elif number.endswith("0"):
            kinds["assembly"] += 1
        else:
            kinds["detail"] += 1
    # ТЗ, раздел А5: ЗАДАНИЯ 18 рабочих деталей, ПАРЫ 9, СБОРКИ 3.
    assert kinds == {"detail": 18, "node": 9, "adapter": 9, "assembly": 3}, kinds

    # Ключ узла всегда по возрастанию — так его нормализует parseDay2Input,
    # и `14 13` обязан попасть в ту же карточку, что `13 14`.
    for number in numbers:
        base = number.split(":")[0]
        if "-" not in base:
            continue
        low, high = (int(part) for part in base.split("-"))
        assert low < high, f"узел {base} записан не по возрастанию"
        assert PARTNER[low % 10] == high % 10, f"{base} — не пара по физике тайлов"
        assert low // 10 == high // 10, f"{base} — номера с разных столов"

    for text in texts:
        for field in ("question", "description", "task", "dueMidday"):
            assert str(text.get(field) or "").strip(), f"{text['number']}: пусто поле {field}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default=env_content_dir())
    args = ap.parse_args()
    if not args.dir or not os.path.isdir(args.dir):
        sys.exit(f"нет каталога контента: {args.dir}")

    section = os.path.join(args.dir, SLUG)
    os.makedirs(section, exist_ok=True)
    cards, texts = cards_and_texts()
    check(cards, texts)

    write = lambda name, data: json.dump(
        data, open(os.path.join(section, name), "w", encoding="utf-8"),
        ensure_ascii=False, indent=2)

    write("index.json", cards)
    write("TaskText.json", texts)
    write("meta.json", {"rangeName": "Второй день", "rangeStart": 10, "rangeEnd": 36})

    # манифест дополняется, а не переписывается: рядом лежат чужие колоды
    manifest_path = os.path.join(args.dir, "manifest.json")
    manifest = json.load(open(manifest_path, encoding="utf-8")) if os.path.exists(manifest_path) else []
    if SLUG not in manifest:
        manifest.append(SLUG)
        json.dump(manifest, open(manifest_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    print(f"секция {SLUG}: {len(cards)} карточек, {len(texts)} текстов -> {section}")
    print("номера:", ", ".join(c["number"] for c in cards))


if __name__ == "__main__":
    main()
