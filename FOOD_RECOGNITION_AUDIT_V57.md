# Food recognition audit V57

Build: 2026-08-15-v57-complete-menu-recognition

## Automated regression result

- Authoritative foods exposed by the Thực phẩm catalog/parser: 301
- Missing canonical English names: 0
- Vietnamese exact-name recognition failures: 0
- English exact-name recognition failures: 0
- Excel-style `100g <Vietnamese name>` recognition failures: 0
- Excel-style `100g <English name>` recognition failures: 0

## Added in V57

- Tóp mỡ chiên / pork cracklings / fried pork cracklings / fried pork fat
- Bánh gạo / rice cake / rice cake cracker / rice cracker
- Bưởi / pomelo / pummelo / shaddock
- Súp kem bí đỏ / creamy pumpkin soup / pumpkin cream soup / cream of pumpkin soup

## Regression spot checks

Passed:
- 100g bacon
- 100g mushroom
- 100g dried anchovies
- 100g tép khô
- 100g Tóp mỡ chiên
- 100g pork cracklings
- 100g Bánh gạo
- 100g rice cake
- 100g Bưởi
- 100g pomelo
- 1 bát Súp kem bí đỏ
- 1 bowl creamy pumpkin soup

The UI/layout and existing catalog/functionality are otherwise unchanged.
