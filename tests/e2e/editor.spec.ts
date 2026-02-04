import { test, expect } from '@playwright/test';
import path from 'path';

const fixturePath = path.resolve('tests/fixtures/test.png');

test('load image, crop apply, undo', async ({ page }) => {
  await page.goto('/');

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(fixturePath);

  await expect(page.locator('.status-bar')).toContainText('120×80px');

  const canvas = page.locator('[data-testid="editor-canvas"]');
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();

  if (box) {
    const startX = box.x + box.width * 0.3;
    const startY = box.y + box.height * 0.3;
    const endX = box.x + box.width * 0.6;
    const endY = box.y + box.height * 0.6;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY);
    await page.mouse.up();
  }

  await expect(page.locator('.app')).toHaveAttribute('data-crop-active', 'true');
  await page.locator('[data-testid="crop-apply"]').click();
  await expect(page.locator('.app')).toHaveAttribute('data-crop-active', 'false');
  await expect(page.locator('.app')).toHaveAttribute('data-crop-applied', 'true');

  await page.keyboard.press('Control+Z');
  await expect(page.locator('.app')).toHaveAttribute('data-crop-applied', 'false');
});
