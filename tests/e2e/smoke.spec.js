import { expect, test } from "@playwright/test";

async function createRoom(page, name = "Алекс") {
  await page.goto("/");
  await page.getByLabel("Имя").fill(name);
  await page.getByRole("button", { name: "Создать комнату" }).click();
  await expect(page).toHaveURL(/\/room\/[a-zA-Z0-9_-]+/);
  await expect(page.getByRole("heading", { name: "Готовы войти?" })).toBeVisible();
  await page.getByRole("button", { name: /Войти в комнату/ }).click();
  await expect(page.getByText(`${name} (вы)`)).toBeVisible();
  return page.url();
}

async function joinRoom(page, url, name) {
  await page.goto(url);
  await page.getByLabel("Имя").fill(name);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page.getByRole("heading", { name: "Готовы войти?" })).toBeVisible();
  await page.getByRole("button", { name: /Войти в комнату/ }).click();
  await expect(page.getByText(`${name} (вы)`)).toBeVisible();
}

test("creates room, joins second participant and exchanges chat message", async ({ browser }) => {
  const first = await browser.newPage();
  const roomUrl = await createRoom(first);

  const second = await browser.newPage();
  await joinRoom(second, roomUrl, "Мария");

  await first.getByLabel("Сообщение").fill("Привет");
  await first.getByTitle("Отправить").click();

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
  await fifth.getByLabel("Имя").fill("User 5");
  await fifth.getByRole("button", { name: "Войти" }).click();
  await fifth.getByRole("button", { name: /Войти в комнату/ }).click();
  await expect(fifth.getByText("Комната заполнена")).toBeVisible();

  await Promise.all(pages.map((page) => page.close()));
});

test("toggles chat panel from controls", async ({ browser }) => {
  const page = await browser.newPage();
  await createRoom(page, "Алекс");

  const chatPanel = page.getByLabel("Чат и участники");
  await expect(chatPanel).toBeVisible();
  await page.getByTitle("Скрыть чат").click();
  await expect(chatPanel).toBeHidden();
  await page.getByTitle("Показать чат").click();
  await expect(chatPanel).toBeVisible();

  await page.close();
});
