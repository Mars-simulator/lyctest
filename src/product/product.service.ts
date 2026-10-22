import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { Product } from './product.entity.js';
import {
  redisClient,
  bloomFilter,
  CACHE_PROD_KEY,
  NULL_TTL,
  BASE_TTL,
  RANDOM_OFFSET,
  tryAcquireLock,
  releaseLock,
} from '../config/redis.config.js';

@Injectable()
export class ProductService implements OnModuleInit {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async onModuleInit() {
    // ========= 修复TypeORM select类型报错 =========
    const allIds = await this.productRepo.find({
      select: { id: true },
    });
    allIds.forEach(item => bloomFilter.add(String(item.id)));
    console.log(`布隆过滤器预热完成，共加载 ${allIds.length} 条商品ID`);
  }

  async getProductById(id: number): Promise<Product | null> {
    if (!bloomFilter.has(String(id))) {
      return null;
    }

    const cacheKey = `${CACHE_PROD_KEY}${id}`;
    const cacheVal = await redisClient.get(cacheKey);

    if (cacheVal !== null) {
      if (cacheVal === 'NULL') return null;
      return JSON.parse(cacheVal) as Product;
    }

    const lockKey = `lock:product:${id}`;
    const lockTtl = 10000;
    let lockUuid: string | null = null;
    try {
      // 获取锁，最多等待3次，每次等待200ms
      let retry = 3;
      while (retry > 0) {
        lockUuid = await tryAcquireLock(lockKey, lockTtl);
        if (lockUuid) break;
        retry--;
        await new Promise(r => setTimeout(r, 200));
      }
      if (!lockUuid) {
        throw new Error('请求繁忙，请稍后重试');
      }

      // 双重检查
      const doubleCheck = await redisClient.get(cacheKey);
      if (doubleCheck !== null) {
        if (doubleCheck === 'NULL') return null;
        return JSON.parse(doubleCheck) as Product;
      }

      console.log('==== 回源DB查询 id:', id);
      const product = await this.productRepo.findOneBy({ id });

      if (!product) {
        await redisClient.set(cacheKey, 'NULL', 'EX', NULL_TTL);
        return null;
      }

      const ttl = BASE_TTL + Math.floor(Math.random() * RANDOM_OFFSET);
      await redisClient.set(cacheKey, JSON.stringify(product), 'EX', ttl);
      return product;
    } catch (err) {
      console.error('get product lock error', err);
      throw new Error('请求繁忙，请稍后重试');
    } finally {
      // 释放锁
      if (lockUuid) {
        await releaseLock(lockKey, lockUuid).catch(console.error);
      }
    }
  }

  async updateProduct(dto: UpdateProductDto): Promise<boolean> {
    // 字段白名单：只允许更新 DTO 声明的列，防止通过额外键篡改其它字段
    const patch: Partial<Product> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.price !== undefined) patch.price = dto.price;
    if (Object.keys(patch).length === 0) return false;

    const result = await this.productRepo.update(dto.id, patch);
    if (result.affected === 0) return false;

    const cacheKey = `${CACHE_PROD_KEY}${dto.id}`;
    await redisClient.del(cacheKey);

    // 延迟双删；unref 让该定时器不阻塞进程退出
    setTimeout(async () => {
      await redisClient.del(cacheKey).catch(console.error);
    }, 500).unref();

    return true;
  }

  async addProduct(dto: CreateProductDto): Promise<number> {
    // 只取白名单字段，避免 mass assignment
    const entity = this.productRepo.create({ name: dto.name, price: dto.price });
    const saved = await this.productRepo.save(entity);
    bloomFilter.add(String(saved.id));
    return saved.id;
  }
}
