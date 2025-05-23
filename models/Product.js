const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  image: {
    type: String,
    required: true,
    default:
      "https://images.pexels.com/photos/1137335/pexels-photo-1137335.jpeg?auto=compress&cs=tinysrgb&w=600",
  },
  category: {
    type: String,
    required: true,
    enum: [
      "Vegetables",
      "Fruits",
      "Flowers",
      "Honey",
      "Crops",
      "Farm Tools",
      "Manure",
      "Pesticides",
    ],
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: String,
    default: () => {
      const date = new Date();
      const day = date.getDate().toString().padStart(2, "0");
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const year = date.getFullYear();
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    },
  },
});

module.exports = mongoose.model("Product", productSchema);
