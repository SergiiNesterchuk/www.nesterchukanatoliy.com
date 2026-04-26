import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { createHash } from "crypto";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Categories
  const bordoska = await prisma.category.upsert({
    where: { slug: "bordoska-sumish" },
    update: {},
    create: {
      name: "Бордоська суміш",
      slug: "bordoska-sumish",
      description:
        "Бордоська суміш для захисту саду від хвороб. Перевірений засіб для обприскування дерев та кущів.",
      sortOrder: 1,
      metaTitle: "Бордоська суміш — купити набір для приготування",
      metaDesc:
        "Набір для приготування бордоської суміші 3%. Мідний купорос та вапно у правильних пропорціях. Доставка по Україні.",
    },
  });

  const otset = await prisma.category.upsert({
    where: { slug: "yabluchnyi-otset" },
    update: {},
    create: {
      name: "Яблучний оцет",
      slug: "yabluchnyi-otset",
      description:
        "Натуральний яблучний оцет власного виробництва без хімії та штучних добавок. Живий нефільтрований продукт.",
      sortOrder: 2,
      metaTitle: "Натуральний яблучний оцет — купити",
      metaDesc:
        "Натуральний яблучний оцет власного виробництва. Живий нефільтрований продукт для здоров'я. Доставка Новою Поштою.",
    },
  });

  // Products
  const products = [
    {
      sku: "01",
      name: "Набір для приготування 30л 3% бордоської суміші",
      slug: "nabir-dlia-pryhotuvannia-30l-3-bordoskoi-sumishi",
      shortDescription:
        "Повний набір для приготування 30 літрів 3% бордоської суміші. Мідний купорос та вапно у правильних пропорціях.",
      description: `<h2>Набір для приготування бордоської суміші</h2>
<p>Повний набір включає мідний купорос та негашене вапно у точних пропорціях для приготування 30 літрів 3% бордоської суміші.</p>
<h3>Що входить у набір:</h3>
<ul>
<li>Мідний купорос — 900 г</li>
<li>Негашене вапно — 900 г</li>
<li>Інструкція з приготування</li>
</ul>
<h3>Для чого використовується:</h3>
<p>Бордоська суміш — перевірений часом фунгіцид для захисту плодових дерев, кущів та виноградників від грибкових хвороб: парші, монілія, мілдью, кокомікозу та інших.</p>
<h3>Коли обприскувати:</h3>
<ul>
<li>Рання весна — до розпускання бруньок (3% розчин)</li>
<li>Осінь — після листопаду (3% розчин)</li>
<li>Під час вегетації — 1% розчин</li>
</ul>`,
      price: 45000,
      stockStatus: "out_of_stock",
      quantity: 0,
      categoryId: bordoska.id,
      sortOrder: 1,
      metaTitle: "Набір бордоської суміші 30л 3% — купити",
      metaDesc:
        "Купити набір для приготування 30л бордоської суміші 3%. Мідний купорос + вапно. Доставка по Україні Новою Поштою.",
      images: [
        {
          url: "/images/products/bordoska-sumish-1.jpg",
          alt: "Набір бордоської суміші — мідний купорос та вапно",
          sortOrder: 0,
        },
      ],
    },
    {
      sku: "02",
      name: "Яблучний оцет 0.5л скло",
      slug: "yabluchnyi-otset-0.5l-sklo",
      shortDescription:
        "Натуральний яблучний оцет 0.5 л у скляній пляшці. Живий, нефільтрований, без консервантів.",
      description: `<h2>Натуральний яблучний оцет 0.5л</h2>
<p>Живий нефільтрований яблучний оцет власного виробництва. Виготовлений із натуральних яблук без додавання цукру, хімічних добавок та консервантів.</p>
<h3>Особливості:</h3>
<ul>
<li>100% натуральний продукт</li>
<li>Живий, нефільтрований — містить «матку» оцту</li>
<li>Без цукру, без консервантів</li>
<li>Скляна пляшка 0.5 л</li>
</ul>
<h3>Застосування:</h3>
<ul>
<li>Для щоденного вживання (розведений у воді)</li>
<li>Для салатів та соусів</li>
<li>Для консервації</li>
<li>Для косметичних процедур</li>
</ul>`,
      price: 28000,
      stockStatus: "in_stock",
      quantity: 58,
      categoryId: otset.id,
      sortOrder: 1,
      metaTitle: "Яблучний оцет 0.5л скло — натуральний, купити",
      metaDesc:
        "Натуральний яблучний оцет 0.5л у скляній пляшці. Живий нефільтрований продукт. Доставка по Україні.",
      images: [
        {
          url: "/images/products/yabluchnyi-otset-05l.jpg",
          alt: "Яблучний оцет 0.5л скляна пляшка",
          sortOrder: 0,
        },
      ],
    },
    {
      sku: "03",
      name: "Яблучний оцет 1л скло",
      slug: "yabluchnyi-otset-1l-sklo",
      shortDescription:
        "Натуральний яблучний оцет 1 л у скляній пляшці. Живий, нефільтрований, без консервантів.",
      description: `<h2>Натуральний яблучний оцет 1л</h2>
<p>Живий нефільтрований яблучний оцет у скляній літровій пляшці. Виготовлений із натуральних яблук, витриманий за класичною технологією.</p>
<h3>Особливості:</h3>
<ul>
<li>100% натуральний продукт</li>
<li>Живий, нефільтрований</li>
<li>Скляна пляшка 1 л — найкраще збереження</li>
<li>Без цукру, без консервантів</li>
</ul>`,
      price: 48000,
      stockStatus: "in_stock",
      quantity: 40,
      categoryId: otset.id,
      sortOrder: 2,
      metaTitle: "Яблучний оцет 1л скло — натуральний, купити",
      metaDesc:
        "Натуральний яблучний оцет 1л у скляній пляшці. Живий, нефільтрований. Доставка Новою Поштою по Україні.",
      images: [
        {
          url: "/images/products/yabluchnyi-otset-1l-sklo.jpg",
          alt: "Яблучний оцет 1л скляна пляшка",
          sortOrder: 0,
        },
      ],
    },
    {
      sku: "04",
      name: "Яблучний оцет 1л пластик",
      slug: "yabluchnyi-otset-1l-plastyk",
      shortDescription:
        "Натуральний яблучний оцет 1 л у пластиковій пляшці. Живий, нефільтрований, без консервантів.",
      description: `<h2>Натуральний яблучний оцет 1л (пластик)</h2>
<p>Живий нефільтрований яблучний оцет у пластиковій літровій пляшці. Зручний формат для побутового використання.</p>
<h3>Особливості:</h3>
<ul>
<li>100% натуральний продукт</li>
<li>Живий, нефільтрований</li>
<li>Пластикова пляшка 1 л — легша та зручніша</li>
<li>Без цукру, без консервантів</li>
</ul>`,
      price: 45000,
      stockStatus: "in_stock",
      quantity: 35,
      categoryId: otset.id,
      sortOrder: 3,
      metaTitle: "Яблучний оцет 1л пластик — натуральний, купити",
      metaDesc:
        "Натуральний яблучний оцет 1л у пластиковій пляшці. Живий продукт без хімії. Доставка по Україні.",
      images: [
        {
          url: "/images/products/yabluchnyi-otset-1l-plastyk.jpg",
          alt: "Яблучний оцет 1л пластикова пляшка",
          sortOrder: 0,
        },
      ],
    },
  ];

  for (const { images, ...productData } of products) {
    const product = await prisma.product.upsert({
      where: { slug: productData.slug },
      update: {},
      create: productData,
    });

    // Only add seed images if product has NO images at all
    // This prevents ghost images on re-seed when R2 images already exist
    const existingImages = await prisma.productImage.count({ where: { productId: product.id } });
    if (existingImages === 0) {
      for (const image of images) {
        await prisma.productImage.create({
          data: { ...image, productId: product.id },
        });
      }
    }
  }

  // Pages
  const pages = [
    {
      title: "Про нас",
      slug: "pro-nas",
      content: `<h1>Про нас</h1>
<p>Мене звати Анатолій Нестерчук. Я багато років займаюся садом, обрізкою дерев і обробками, і ділюся цим досвідом з аудиторією понад 1 мільйон людей.</p>
<p>У нашому магазині ви знайдете тільки ті продукти, які я особисто використовую та рекомендую:</p>
<ul>
<li><strong>Натуральний яблучний оцет</strong> — власного виробництва, без хімії та штучних добавок</li>
<li><strong>Бордоська суміш</strong> — перевірений засіб для захисту саду</li>
</ul>
<p>Якщо я рекомендую — значить я цим користуюся сам.</p>`,
      metaTitle: "Про нас — Магазин Анатолія Нестерчука",
      metaDesc:
        "Анатолій Нестерчук — садівник з досвідом та аудиторією 1 млн людей. Натуральний яблучний оцет та бордоська суміш.",
    },
    {
      title: "Оплата і доставка",
      slug: "oplata-i-dostavka",
      content: `<h1>Оплата і доставка</h1>
<h2>Оплата</h2>
<p>Оплата здійснюється онлайн банківською карткою (Visa/Mastercard) через захищений платіжний сервіс.</p>
<h2>Доставка</h2>
<p>Доставка здійснюється <strong>Новою Поштою</strong> по всій Україні.</p>
<ul>
<li>Термін доставки: 1-3 робочих дні</li>
<li>Вартість доставки: за тарифами Нової Пошти (оплачує покупець)</li>
</ul>
<p>Після відправлення ви отримаєте номер ТТН для відстеження.</p>`,
      metaTitle: "Оплата і доставка — Магазин Анатолія Нестерчука",
      metaDesc:
        "Оплата карткою онлайн. Доставка Новою Поштою по всій Україні за 1-3 дні.",
    },
    {
      title: "Контактна інформація",
      slug: "kontaktna-informatsiya",
      content: `<h1>Контактна інформація</h1>
<p><strong>ФОП Нестерчук Анатолій Григорович</strong></p>
<p>Телефон: <a href="tel:+380930003008">093-000-3008</a> (також Viber)</p>
<p>Email: <a href="mailto:marina.onof38@gmail.com">marina.onof38@gmail.com</a></p>
<p>Адреса: Україна, 07400, Київська обл., Броварський р-н, м. Бровари, вул. Симона Петлюри, буд. 16, корпус Г, кв. 104</p>
<p>ІПН: 2614810893</p>`,
      metaTitle: "Контакти — Магазин Анатолія Нестерчука",
      metaDesc: "Зв'яжіться з нами: 093-000-3008, marina.onof38@gmail.com. Бровари, Київська обл.",
    },
    {
      title: "Умови використання",
      slug: "umovy-vykorystannia",
      content: `<h1>Умови використання</h1>
<p>Цей документ є публічною офертою ФОП Нестерчук Анатолій Григорович.</p>
<h2>Загальні положення</h2>
<p>Оформлення замовлення на сайті означає згоду покупця з умовами цієї оферти.</p>
<h2>Повернення та обмін</h2>
<p>Повернення товару належної якості можливе протягом 14 днів з моменту отримання, за умови збереження товарного вигляду та упаковки.</p>
<h2>Відповідальність</h2>
<p>Продавець не несе відповідальності за затримки доставки, спричинені перевізником.</p>`,
      metaTitle: "Умови використання — Магазин Анатолія Нестерчука",
      metaDesc: "Публічна оферта, умови повернення та обміну товарів. Магазин Анатолія Нестерчука.",
    },
  ];

  for (const page of pages) {
    await prisma.page.upsert({
      where: { slug: page.slug },
      update: {},
      create: page,
    });
  }

  // System navigation page: "Статус замовлення"
  await prisma.page.upsert({
    where: { slug: "order-status" },
    update: {},
    create: {
      title: "Статус замовлення",
      slug: "order-status",
      content: "Системна сторінка — контент не відображається, використовується як навігаційне посилання.",
      isActive: true,
      showInNav: false,
      showInFooter: true,
      showInMobileMenu: true,
      displayOnHome: false,
      isSystem: true,
      sortOrder: 99,
    },
  });

  // Settings
  const settings = [
    { key: "site_name", value: "Магазин Анатолія Нестерчука" },
    { key: "site_description", value: "Натуральний яблучний оцет та бордоська суміш для саду" },
    { key: "phone", value: "093-000-3008" },
    { key: "email", value: "marina.onof38@gmail.com" },
    { key: "ga4_id", value: "G-JT8BTTGSC2" },
    { key: "clarity_id", value: "vpdpsqf2ig" },
  ];

  for (const setting of settings) {
    await prisma.settings.upsert({
      where: { key: setting.key },
      update: {}, // Don't overwrite existing values
      create: setting,
    });
  }

  // Social links — idempotent, don't overwrite production edits
  const socialDefaults = [
    { key: "social_instagram", value: "https://www.instagram.com/nesterchuk_anatoliy" },
    { key: "social_youtube", value: "https://youtube.com/@nesterchuk_anatoliy" },
    { key: "social_facebook", value: "https://www.facebook.com/profile.php?id=100025198117909" },
    { key: "social_tiktok", value: "https://www.tiktok.com/@nesterchuk_anatoliy" },
  ];

  for (const s of socialDefaults) {
    await prisma.settings.upsert({
      where: { key: s.key },
      update: {}, // Don't overwrite
      create: s,
    });
  }

  // TopBar defaults
  const topbarDefaults = [
    { key: "topbar_enabled", value: "true" },
    { key: "topbar_show_phone", value: "true" },
    { key: "topbar_phone", value: "093-000-3008" },
    { key: "topbar_phone_label", value: "093-000-3008" },
    { key: "topbar_phone_link_type", value: "tel" },
    { key: "topbar_show_socials", value: "true" },
  ];

  for (const s of topbarDefaults) {
    await prisma.settings.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }

  // Admin user — логін/пароль з Railway env: ADMIN_LOGIN, ADMIN_PASSWORD
  const adminEmail = process.env.ADMIN_LOGIN || "admin@nesterchukanatoliy.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "changeme";
  const passwordHash = createHash("sha256").update(adminPassword).digest("hex");
  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: { passwordHash },
    create: {
      email: adminEmail,
      passwordHash,
      name: "Адміністратор",
      role: "admin",
    },
  });

  // Payment methods (idempotent — won't overwrite admin changes)
  const paymentMethods = [
    {
      key: "card_wayforpay",
      title: "Оплата карткою онлайн",
      description: "Visa / Mastercard через захищений платіжний сервіс",
      customerInstruction: "Дякуємо! Ми отримали вашу оплату у розмірі {paidAmount} грн. Ваше замовлення {orderNumber} буде відправлено протягом 1-3 днів.",
      enabled: true,
      requiresOnlinePayment: true,
      sortOrder: 1,
    },
    {
      key: "cod_cash_on_delivery",
      title: "Накладений платіж з передплатою 200 грн",
      description: "Передплата 200 грн онлайн, решта — при отриманні у Новій Пошті",
      customerInstruction: "Дякуємо! Ми отримали передплату {prepaymentAmount} грн по замовленню {orderNumber}. Ваше замовлення буде відправлено протягом 1-3 днів. Залишок до оплати при отриманні: {remainingAmount} грн.",
      enabled: false,
      requiresOnlinePayment: true,
      sortOrder: 2,
    },
    {
      key: "bank_transfer",
      title: "Оплата на рахунок",
      description: "Після оформлення менеджер надішле реквізити для оплати",
      customerInstruction: "Замовлення {orderNumber} прийнято! Очікуйте, наш менеджер надішле вам реквізити для оплати у Viber або за вказаними контактами. Після отримання оплати ми підготуємо замовлення до відправки.",
      enabled: true,
      requiresOnlinePayment: false,
      sortOrder: 3,
    },
  ];

  for (const pm of paymentMethods) {
    await prisma.paymentMethod.upsert({
      where: { key: pm.key },
      update: { customerInstruction: pm.customerInstruction }, // Оновити шаблон success message
      create: pm,
    });
  }

  console.log("Seed completed successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
