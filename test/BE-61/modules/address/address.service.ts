import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
// [FIX] Sửa tên class import đúng là GhnService
import { GhnService } from '../ghn/ghn.service'; 

@Injectable()
export class AddressService {
  constructor(
    private prisma: PrismaService,
    private ghnService: GhnService // [FIX] Inject đúng class GhnService
  ) {}

  // Helper: Tạo địa chỉ đầy đủ string bằng cách gọi GHN lấy tên Tỉnh/Huyện/Xã
  private async buildFullAddress(dto: CreateAddressDto): Promise<string> {
    try {
      // 1. Lấy tên Tỉnh
      const provinces = await this.ghnService.getProvinces();
      const provinceName = provinces.find((p: any) => p.ProvinceID === dto.provinceId)?.ProvinceName || '';

      // 2. Lấy tên Quận/Huyện
      const districts = await this.ghnService.getDistricts(dto.provinceId);
      const districtName = districts.find((d: any) => d.DistrictID === dto.districtId)?.DistrictName || '';

      // 3. Lấy tên Phường/Xã
      const wards = await this.ghnService.getWards(dto.districtId);
      const wardName = wards.find((w: any) => w.WardCode === dto.wardCode)?.WardName || '';

      // 4. Ghép chuỗi
      const parts = [
        dto.specificAddress,
        wardName,
        districtName,
        provinceName
      ].filter(Boolean); // Lọc bỏ giá trị rỗng

      return parts.join(', ');
    } catch (error) {
      // Fallback nếu lỗi API GHN thì trả về chuỗi ID (hoặc chỉ specificAddress)
      return `${dto.specificAddress}, Phường ${dto.wardCode}, Quận ${dto.districtId}, Tỉnh ${dto.provinceId}`;
    }
  }

  async create(userId: string, dto: CreateAddressDto) {
    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const count = await this.prisma.address.count({ where: { userId } });
    const isDefault = count === 0 ? true : dto.isDefault || false;

    // Build full string hiển thị
    const fullAddress = await this.buildFullAddress(dto);

    return this.prisma.address.create({
      data: {
        userId,
        ...dto,
        isDefault,
        fullAddress,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: { isDefault: 'desc' },
    });
  }

  async update(userId: string, id: string, dto: UpdateAddressDto) {
    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const fullAddress = await this.buildFullAddress(dto);

    return this.prisma.address.update({
      where: { id, userId },
      data: {
        ...dto,
        fullAddress,
      },
    });
  }

  async remove(userId: string, id: string) {
    return this.prisma.address.delete({
      where: { id, userId },
    });
  }

  async setDefault(userId: string, id: string) {
    await this.prisma.$transaction([
      this.prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.address.update({
        where: { id, userId },
        data: { isDefault: true },
      }),
    ]);
    return true;
  }
}