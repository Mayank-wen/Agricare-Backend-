const { User, Product, Order } = require("../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

const DEFAULT_PRODUCT_IMAGE = "default-product.jpg";

const resolvers = {
  Mutation: {
    // Auth Mutations
    signup: async (_, { input }) => {
      try {
        const { name, email, password, role } = input;

        // Check existing user
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          throw new Error("Email already registered");
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const user = new User({
          name,
          email,
          password: hashedPassword,
          role: role || "buyer",
          createdAt: (() => {
            const date = new Date();
            const day = date.getDate().toString().padStart(2, "0");
            const month = (date.getMonth() + 1).toString().padStart(2, "0");
            const year = date.getFullYear();
            const hours = date.getHours().toString().padStart(2, "0");
            const minutes = date.getMinutes().toString().padStart(2, "0");
            return `${day}/${month}/${year} ${hours}:${minutes}`;
          })(),
        });

        await user.save();

        // Generate token
        const token = jwt.sign(
          { id: user.id, email: user.email, role: user.role },
          process.env.JWT_SECRET
        );

        return {
          token,
          user,
        };
      } catch (error) {
        throw new Error(`Signup failed: ${error.message}`);
      }
    },

    // Add console logs for debugging
    login: async (_, { input }) => {
      const { email, password } = input;
      console.log("Login attempt for email:", email);

      const user = await User.findOne({ email });
      if (!user) {
        console.log("User not found for email:", email);
        throw new Error("User not found");
      }
      console.log("Found user:", user);

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        console.log("Invalid password for user:", email);
        throw new Error("Invalid password");
      }
      console.log("Password validated successfully");
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        process.env.JWT_SECRET
      );
      console.log("Generated token:", token);
      console.log("Token payload:", jwt.decode(token));
      return {
        token,
        user,
      };
    },
    createProduct: async (_, { input }, { user }) => {
      try {
        if (!user) throw new Error("Not authenticated");

        // Create new product
        const product = new Product({
          ...input,
          seller: user.id,
          createdAt: new Date().toISOString(),
          image: input.image || DEFAULT_PRODUCT_IMAGE,
        });

        // Log product creation with image
        console.log("Creating product:", {
          name: input.name,
          price: input.price,
          image: product.image,
          category: input.category,
        });

        const savedProduct = await product.save();
        const populatedProduct = await Product.findById(
          savedProduct._id
        ).populate("seller");

        console.log("Saved and populated product:", populatedProduct);
        return populatedProduct;
      } catch (error) {
        console.error("Product creation error:", error);
        throw new Error(`Error creating product: ${error.message}`);
      }
    },

    updateProduct: async (_, { id, input }) => {
      try {
        return await Product.findByIdAndUpdate(
          id,
          {
            name: input.name,
            price: input.price,
            image: input.image,
            category: input.category,
            quantity: input.quantity,
          },
          { new: true }
        );
      } catch (error) {
        throw new Error(`Error updating product: ${error.message}`);
      }
    },

    deleteProduct: async (_, { id }) => {
      try {
        await Product.findByIdAndDelete(id);
        return true;
      } catch (error) {
        throw new Error(`Error deleting product: ${error.message}`);
      }
    },

    uploadProductImage: async (_, { file }) => {
      try {
        const { createReadStream, filename } = await file;
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const newFilename = uniqueSuffix + path.extname(filename);
        const stream = createReadStream();
        const pathName = path.join(__dirname, `../uploads/${newFilename}`);

        await new Promise((resolve, reject) => {
          const writeStream = fs.createWriteStream(pathName);
          stream.pipe(writeStream);
          writeStream.on("finish", resolve);
          writeStream.on("error", reject);
        });

        return `/uploads/${newFilename}`;
      } catch (error) {
        console.error("Error uploading image:", error);
        throw new Error("Failed to upload image");
      }
    },

    // Order Mutations
    createOrder: async (_, { products }, { user }) => {
      if (!user) throw new Error("Not authenticated");

      try {
        let total = 0;
        const orderProducts = [];

        // Calculate total and prepare order products
        for (const item of products) {
          const product = await Product.findById(item.productId);
          if (!product) throw new Error(`Product ${item.productId} not found`);
          if (product.quantity < item.quantity) {
            throw new Error(`Not enough stock for ${product.name}`);
          }

          const itemTotal = product.price * item.quantity;
          total += itemTotal;

          orderProducts.push({
            product: item.productId,
            quantity: item.quantity,
            price: product.price,
          });

          // Update product quantity
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { quantity: -item.quantity },
          });
        }

        const order = new Order({
          buyer: user.id,
          products: orderProducts,
          total: total,
          status: "pending",
        });

        await order.save();
        return order.populate("products.product");
      } catch (error) {
        throw new Error(`Failed to create order: ${error.message}`);
      }
    },

    updateOrderStatus: async (_, { id, status }, { user }) => {
      if (!user) throw new Error("Not authenticated");

      const order = await Order.findById(id);
      if (!order) throw new Error("Order not found");
      if (user.role !== "farmer") {
        throw new Error("Not authorized to update order status");
      }

      return await Order.findByIdAndUpdate(
        id,
        { status },
        { new: true }
      ).populate("buyer");
    },

    logout: async (_, __, { user }) => {
      if (!user) {
        throw new Error("Not authenticated");
      }
      // Since JWT tokens are stateless, we just return true
      // The client will handle removing the token
      return true;
    },
  },
};

module.exports = resolvers;
