export interface CMRData {
    shipment: string;
    sender: string;
    recipient: string;
    delivery_place: string;
    taking_over: string;
    marks_nos: string;
    goods_nature: string;
    gross_weight: string;
    volume: string;
    seal: string;
    trailer: string;
    consignments: string; // 'MULTI' or list
    est_arrival_date: string;
    est_arrival_time: string;
}

export interface ProcessingResult {
    fileName: string;
    blob: Blob;
    data: CMRData;
}
