import { expect, test } from "@playwright/test";

async function createRoom(page, roomName = "Комната") {
  await page.goto("/");
  await page.getByLabel("Имя комнаты").fill(roomName);
  await page.getByRole("button", { name: "Создать комнату" }).click();
  await expect(page).toHaveURL(/\/room\/[a-zA-Z0-9_-]+/);
  const roomId = new URL(page.url()).pathname.split("/").pop();
  await expect(page.getByRole("heading", { name: "Готовы войти?" })).toBeVisible();
  await expect(page.getByText(`ID комнаты: ${roomId}`)).toBeVisible();
  await page.getByLabel("Имя пользователя").fill("Алекс");
  await page.getByRole("button", { name: /Войти в комнату/ }).click();
  await expect(page.getByText("Алекс (вы)")).toBeVisible();
  await expect(page.locator(".room-main__room-name")).toHaveText(roomName);
  return page.url();
}

async function joinRoom(page, url, name) {
  await page.goto(url);
  await page.getByLabel("Имя пользователя").fill(name);
  await expect(page.getByRole("heading", { name: "Готовы войти?" })).toBeVisible();
  await page.getByRole("button", { name: /Войти в комнату/ }).click();
  await expect(page.getByText(`${name} (вы)`)).toBeVisible();
}

async function expectVideoHasVisibleFrame(videoLocator) {
  await expect.poll(async () => videoLocator.evaluate((video) => {
    if (!video.srcObject || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
      return false;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 80;
    canvas.height = 45;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return false;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;

    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] > 12 || pixels[index + 1] > 12 || pixels[index + 2] > 12) {
        return true;
      }
    }

    return false;
  }), { timeout: 8_000 }).toBe(true);
}

test("creates room, joins second participant and exchanges chat message", async ({ browser }) => {
  const first = await browser.newPage();
  const roomUrl = await createRoom(first);

  const second = await browser.newPage();
  await joinRoom(second, roomUrl, "Мария");

  await expect(first.locator(".room-main__stage video")).toHaveCount(2);
  await expect(second.locator(".room-main__stage video")).toHaveCount(2);
  await expect(first.getByLabel("Чат и участники")).toHaveClass(/chat-panel--closed/);

  await first.getByTitle("Выключить микрофон").click();
  await expect(first.getByTitle("Включить микрофон")).toBeVisible();
  await first.getByTitle("Включить микрофон").click();
  await expect(first.getByTitle("Выключить микрофон")).toBeVisible();
  await expect(second.locator(".room-main__stage video")).toHaveCount(2);

  await first.getByTitle("Выключить камеру").click();
  await expect(first.getByTitle("Включить камеру")).toBeVisible();
  await first.getByTitle("Включить камеру").click();
  await expect(first.getByTitle("Выключить камеру")).toBeVisible();
  await expect(second.locator(".room-main__stage video")).toHaveCount(2);
  await expectVideoHasVisibleFrame(second.locator(".participant-tile").filter({ hasText: "Алекс" }).locator("video"));

  await first.getByTitle("Выключить камеру").click();
  await expect(first.getByTitle("Включить камеру")).toBeVisible();
  await first.getByTitle("Включить камеру").click();
  await expect(first.getByTitle("Выключить камеру")).toBeVisible();
  await expect(second.locator(".room-main__stage video")).toHaveCount(2);
  await expectVideoHasVisibleFrame(second.locator(".participant-tile").filter({ hasText: "Алекс" }).locator("video"));

  await first.getByTitle("Транслировать экран").click();
  await expect(first.getByTitle("Остановить трансляцию экрана")).toBeVisible();
  await expect(second.locator(".room-main__stage video")).toHaveCount(2);
  await first.getByTitle("Остановить трансляцию экрана").click();
  await expect(first.getByTitle("Транслировать экран")).toBeVisible();
  await first.getByTitle("Транслировать экран").click();
  await expect(first.getByTitle("Остановить трансляцию экрана")).toBeVisible();
  await expect(second.locator(".room-main__stage video")).toHaveCount(2);

  await expect(second.getByText("Алекс покинул комнату")).toHaveCount(0);
  await expect(second.getByText("Алекс присоединился к комнате")).toHaveCount(1);

  await first.getByTitle("Показать чат").click();
  await first.getByLabel("Сообщение").fill("Привет");
  await first.getByTitle("Отправить").click();

  await second.getByTitle("Показать чат").click();
  const chat = second.getByLabel("Чат", { exact: true });
  await expect(chat.getByText("Привет")).toBeVisible();
  await expect(chat.getByText("Алекс", { exact: true })).toBeVisible();

  await first.close();
  await second.close();
});

test("rejects fifth participant", async ({ browser }) => {
  const pages = [];
  const first = await browser.newPage();
  pages.push(first);
  const roomUrl = await createRoom(first, "User 1");

  for (let index = 2; index <= 4; index += 1) {
    const page = await browser.newPage();
    pages.push(page);
    await joinRoom(page, roomUrl, `User ${index}`);
  }

  const fifth = await browser.newPage();
  pages.push(fifth);
  await fifth.goto(roomUrl);
  await fifth.getByLabel("Имя пользователя").fill("User 5");
  await fifth.getByRole("button", { name: /Войти в комнату/ }).click();
  await expect(fifth.getByText("Комната заполнена")).toBeVisible();

  await Promise.all(pages.map((page) => page.close()));
});

test("toggles chat panel from controls", async ({ browser }) => {
  const page = await browser.newPage();
  await createRoom(page, "Алекс");

  const chatPanel = page.getByLabel("Чат и участники");
  await expect(chatPanel).toBeHidden();
  await page.getByTitle("Показать чат").click();
  await expect(chatPanel).toBeVisible();
  await page.getByTitle("Скрыть чат").click();
  await expect(chatPanel).toBeHidden();

  await page.close();
});

test("keeps all participants inside mobile viewport", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const roomUrl = await createRoom(page, "Мобильная");
  const guests = [];

  for (let index = 2; index <= 4; index += 1) {
    const guest = await browser.newPage();
    guests.push(guest);
    await joinRoom(guest, roomUrl, `User ${index}`);
  }

  await expect(page.locator(".participant-tile")).toHaveCount(4);

  const metrics = await page.evaluate(() => {
    const controls = document.querySelector(".controls").getBoundingClientRect();
    const stage = document.querySelector(".room-main__stage").getBoundingClientRect();
    const tiles = [...document.querySelectorAll(".participant-tile")].map((tile) => {
      const rect = tile.getBoundingClientRect();
      return {
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width
      };
    });

    return {
      controlsBottom: controls.bottom,
      controlsTop: controls.top,
      documentHeight: document.documentElement.scrollHeight,
      height: window.innerHeight,
      stageBottom: stage.bottom,
      stageTop: stage.top,
      tiles,
      width: window.innerWidth
    };
  });

  expect(metrics.stageTop).toBeGreaterThanOrEqual(0);
  expect(metrics.stageBottom).toBeLessThanOrEqual(metrics.controlsTop);
  expect(metrics.controlsBottom).toBeLessThanOrEqual(metrics.height);
  expect(metrics.documentHeight).toBeLessThanOrEqual(metrics.height + 1);
  expect(metrics.tiles).toHaveLength(4);

  for (const tile of metrics.tiles) {
    expect(tile.top).toBeGreaterThanOrEqual(metrics.stageTop);
    expect(tile.bottom).toBeLessThanOrEqual(metrics.stageBottom);
    expect(tile.left).toBeGreaterThanOrEqual(0);
    expect(tile.right).toBeLessThanOrEqual(metrics.width);
    expect(tile.width).toBeGreaterThan(100);
    expect(tile.height).toBeGreaterThan(80);
  }

  await Promise.all([page, ...guests].map((item) => item.close()));
});

test("opens soundboard menu on mobile", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await createRoom(page, "Саундпад");

  await page.getByTitle("Саундпад").click();

  const menu = page.getByLabel("Саундпад", { exact: true });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("button", { name: "Гудок" })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Тромбон" })).toBeVisible();

  const box = await menu.boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(844);

  await page.close();
});
